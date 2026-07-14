/**
 * app/api/admin/absences/route.ts — Gestione assenze (admin) (TSK-004, TSK-017).
 *
 * GET  /api/admin/absences — Lista tutte le assenze (con filtri).
 * POST /api/admin/absences — Crea assenza (con gestione conflictResolutions TSK-017).
 *
 * TSK-017: POST accetta `absenceAdminWithResolutionsSchema` che include:
 *   - absenceType: enum stringa (ferie/malattia/…)
 *   - conflictResolutions[]: { shiftId, action: annulla|mantieni|riassegna, reassignToUserId? }
 * Per ogni risoluzione "annulla": DELETE del turno.
 * Per ogni risoluzione "riassegna": PATCH userId del turno.
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { absences, absenceTypes, shifts, auditLogs } from '@/db/schema';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { extractIp, extractUserAgent } from '@/lib/audit';
import { absenceAdminWithResolutionsSchema } from '@/lib/zod';

// =============================================================
// GET /api/admin/absences
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  const userIdParam = url.searchParams.get('userId');
  if (userIdParam) conditions.push(eq(absences.userId, userIdParam));

  const statusParam = url.searchParams.get('status');
  if (statusParam) conditions.push(eq(absences.status, statusParam as 'pending'));

  const fromParam = url.searchParams.get('from');
  if (fromParam) conditions.push(gte(absences.startDate, fromParam));

  const toParam = url.searchParams.get('to');
  if (toParam) conditions.push(lte(absences.endDate, toParam));

  const rows = await db
    .select()
    .from(absences)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// =============================================================
// POST /api/admin/absences  (TSK-004 base, esteso TSK-017)
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = absenceAdminWithResolutionsSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { userId, absenceType, startDate, endDate, notes, conflictResolutions } = parsed.data;

  // Mappa enum Zod (label italiane lowercase) → codice DB (3 lettere maiuscole)
  const ABSENCE_CODE_MAP: Record<string, string> = {
    ferie: 'FER',
    malattia: 'MAL',
    permesso: 'PER',
    'maternita-paternita': 'MAT',
    altro: 'ALT',
  };
  // noUncheckedIndexedAccess: absenceType è validato da Zod enum quindi absCode non è mai
  // undefined a runtime, ma il guard soddisfa il typechecker.
  const absCode = ABSENCE_CODE_MAP[absenceType] ?? '';

  // Lookup UUID del tipo assenza dal codice DB (absence_type_id è uuid FK — TSK-017 M3)
  const [absType] = await db
    .select({ id: absenceTypes.id })
    .from(absenceTypes)
    .where(eq(absenceTypes.code, absCode))
    .limit(1);
  if (!absType) return ApiResponse.badRequest('Tipo assenza non valido');

  // ------------------------------------------------------------------
  // TSK-017 + atomicità: tutte le write (conflict resolutions + insert
  // assenza + audit log) sono avvolte in un'unica transazione.
  // Un failure parziale (es. seconda delete che fallisce, o audit log
  // che non si inserisce) causa il rollback completo, evitando stati
  // inconsistenti (turni cancellati ma assenza non creata, o viceversa).
  // Nota: NON si usa insertAuditLog() perché quella helper usa `db`
  // direttamente e ingoia gli errori — entrambi comportamenti sbagliati
  // all'interno di una transazione.
  // ------------------------------------------------------------------
  const newAbsence = await db.transaction(async (tx) => {
    // Risoluzione conflitti prima della scrittura assenza
    if (conflictResolutions && conflictResolutions.length > 0) {
      for (const resolution of conflictResolutions) {
        if (resolution.action === 'annulla') {
          await tx.delete(shifts).where(eq(shifts.id, resolution.shiftId));
          await tx.insert(auditLogs).values({
            actorId: session.user.id as string,
            action: 'shift.delete_for_absence',
            entityType: 'shift',
            entityId: resolution.shiftId,
            before: null,
            after: { reason: 'conflict_resolution_annulla', absenceUserId: userId },
            ip: extractIp(req) ?? null,
            userAgent: extractUserAgent(req) ?? null,
          });
        } else if (resolution.action === 'riassegna' && resolution.reassignToUserId) {
          await tx
            .update(shifts)
            .set({ userId: resolution.reassignToUserId })
            .where(eq(shifts.id, resolution.shiftId));
          await tx.insert(auditLogs).values({
            actorId: session.user.id as string,
            action: 'shift.reassign_for_absence',
            entityType: 'shift',
            entityId: resolution.shiftId,
            before: null,
            after: {
              reason: 'conflict_resolution_riassegna',
              newUserId: resolution.reassignToUserId,
            },
            ip: extractIp(req) ?? null,
            userAgent: extractUserAgent(req) ?? null,
          });
        }
        // action === 'mantieni': nessuna modifica al turno
      }
    }

    // ------------------------------------------------------------------
    // Inserimento assenza
    // ------------------------------------------------------------------

    // TODO TSK-006: validate RB-09 (overlap assenze)
    // TODO TSK-006: validate RB-10 (saldo ferie disponibile)

    const [absence] = await tx
      .insert(absences)
      .values({
        userId,
        absenceTypeId: absType.id,
        startDate,
        endDate,
        notes: notes ?? null,
        status: 'approved', // Inserimento diretto admin → già approvata
        approvedBy: session.user.id as string,
        approvedAt: new Date(),
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorId: session.user.id as string,
      action: 'absence.create',
      entityType: 'absence',
      entityId: absence!.id,
      before: null,
      after: absence,
      ip: extractIp(req) ?? null,
      userAgent: extractUserAgent(req) ?? null,
    });

    return absence!;
  });

  return ApiResponse.created(newAbsence);
}
