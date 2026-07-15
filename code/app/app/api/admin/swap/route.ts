/**
 * app/api/admin/swap/route.ts — Scambio diretto turni (admin) (TSK-026).
 *
 * POST /api/admin/swap[?confirm=true]
 *   - Admin only.
 *   - Scambia due turni tra dipendenti diversi con validazione RB-10.
 *
 * Flusso:
 *   1. Recupera shiftA e shiftB dal DB.
 *   2. Verifica che appartengano a dipendenti diversi.
 *   3. Esegue validateSwap (RB-10) via lib/rules/validateSwap.ts.
 *   4. Se blocking violations → 422 (nessuna modifica DB).
 *   5. Solo warnings + ?confirm=true mancante → 200 con requiresConfirmation.
 *   6. Nessuna blocking + (?confirm=true o nessun warning) → esegue swap:
 *      - UPDATE shifts SET userId su entrambi i turni.
 *      - INSERT swap_operations.
 *      - INSERT audit_log con action='swap.admin'.
 *
 * Risposte:
 *   422 → { outcome: 'rejected', blocking: [...] }
 *   200 → { outcome: 'warnings', requiresConfirmation: true, warnings: [...] }
 *   200 → { outcome: 'executed', swapOperationId: '<uuid>' }
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, swapOperations, absences, auditLogs } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { extractIp, extractUserAgent } from '@/lib/audit';
import { swapCreateSchema } from '@/lib/zod';
import { validateSwap } from '@/lib/rules/validateSwap';
import type { RuleViolation } from '@/lib/rules/types';

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  // Flag conferma esplicita (RF-F CA2)
  const url = new URL(req.url);
  const confirmFlag = url.searchParams.get('confirm') === 'true';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = swapCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { shiftIdA, shiftIdB, notes } = parsed.data;

  // 1. Recupera entrambi i turni
  const [shiftA] = await db.select().from(shifts).where(eq(shifts.id, shiftIdA)).limit(1);
  if (!shiftA) return ApiResponse.notFound(`Turno A (${shiftIdA}) non trovato`);

  const [shiftB] = await db.select().from(shifts).where(eq(shifts.id, shiftIdB)).limit(1);
  if (!shiftB) return ApiResponse.notFound(`Turno B (${shiftIdB}) non trovato`);

  // 2. Verifica che appartengano a dipendenti diversi
  if (shiftA.userId === shiftB.userId) {
    return ApiResponse.badRequest('I turni devono appartenere a dipendenti diversi');
  }

  // 3. Carica tutti i turni e le assenze di entrambi gli utenti per validateSwap
  const allShiftsRows = await db
    .select()
    .from(shifts)
    .where(inArray(shifts.userId, [shiftA.userId, shiftB.userId]));

  const absencesRows = await db
    .select()
    .from(absences)
    .where(inArray(absences.userId, [shiftA.userId, shiftB.userId]));

  const toExistingShift = (s: typeof shiftA) => ({
    id: s.id,
    userId: s.userId,
    startDt: new Date(s.startDt),
    endDt: new Date(s.endDt),
  });

  // 4. Esegue validateSwap (RB-10)
  const validationResult = validateSwap({
    shiftA: toExistingShift(shiftA),
    shiftB: toExistingShift(shiftB),
    allShifts: allShiftsRows.map(toExistingShift),
    absences: absencesRows.map((a) => ({
      id: a.id,
      userId: a.userId,
      startDate: a.startDate,
      endDate: a.endDate,
      status: a.status,
    })),
  });

  // Helper: arricchisce ogni violation con il campo party (A o B).
  // Party A = titolare del turno ceduto (shiftA.userId).
  // Party B = ricevente del turno ceduto (shiftB.userId).
  // Con exactOptionalPropertyTypes usiamo lo spread condizionale per non
  // includere affatto la chiave `party` quando il match è assente.
  const withParty = (v: RuleViolation): RuleViolation => ({
    ...v,
    ...(v.affectedUserId === shiftA.userId
      ? ({ party: 'A' } as const)
      : v.affectedUserId === shiftB.userId
        ? ({ party: 'B' } as const)
        : {}),
  });

  // 4b. Blocking violations → 422, nessuna modifica DB
  if (!validationResult.valid && validationResult.blocking.length > 0) {
    return ApiResponse.ok(
      {
        outcome: 'rejected',
        blocking: validationResult.blocking.map(withParty),
      },
      422
    );
  }

  // 5. Solo warnings, conferma non ancora fornita → 200 con requiresConfirmation
  if (validationResult.warnings.length > 0 && !confirmFlag) {
    return ApiResponse.ok({
      outcome: 'warnings',
      requiresConfirmation: true,
      warnings: validationResult.warnings.map(withParty),
    });
  }

  // 6. Esegue lo swap (nessuna blocking, o warnings con conferma esplicita)
  // Le quattro write (2× UPDATE shift, INSERT swap_operations, INSERT audit_log)
  // sono avvolte in una singola transazione: un failure parziale non lascia
  // il DB in stato inconsistente (RB-10 atomicità).
  const beforeA = { ...shiftA };
  const beforeB = { ...shiftB };

  const swapOp = await db.transaction(async (tx) => {
    // UPDATE shifts: scambia gli userId
    await tx
      .update(shifts)
      .set({ userId: shiftB.userId, updatedAt: new Date() })
      .where(eq(shifts.id, shiftIdA));

    await tx
      .update(shifts)
      .set({ userId: shiftA.userId, updatedAt: new Date() })
      .where(eq(shifts.id, shiftIdB));

    // INSERT swap_operations
    const [op] = await tx
      .insert(swapOperations)
      .values({
        shiftAId: shiftIdA,
        shiftBId: shiftIdB,
        origin: 'admin',
        adminId: session.user.id as string,
        validationOutcome: {
          blocking: validationResult.blocking,
          warnings: validationResult.warnings,
        },
        reason: notes ?? null,
        executedAt: new Date(),
      })
      .returning();

    // INSERT audit_log (RF-F CA4) — inline nel tx per garantire atomicità;
    // NON si usa insertAuditLog perché quella helper usa `db` direttamente
    // e ingoia gli errori (fire-and-forget), entrambi comportamenti scorretti
    // all'interno di una transazione.
    await tx.insert(auditLogs).values({
      actorId: session.user.id as string,
      action: 'swap.admin',
      entityType: 'shift',
      entityId: shiftIdA,
      before: { shiftA: beforeA, shiftB: beforeB } as Record<string, unknown>,
      after: {
        shiftANewUserId: shiftB.userId,
        shiftBNewUserId: shiftA.userId,
        swapOperationId: op!.id,
      } as Record<string, unknown>,
      ip: extractIp(req) ?? null,
      userAgent: extractUserAgent(req) ?? null,
    });

    return op!;
  });

  return ApiResponse.ok({
    outcome: 'executed',
    swapOperationId: swapOp.id,
  });
}
