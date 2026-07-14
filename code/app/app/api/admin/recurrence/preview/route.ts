/**
 * app/api/admin/recurrence/preview/route.ts — Anteprima turni ricorrenza (dry-run).
 *
 * POST /api/admin/recurrence/preview
 *   Admin only. Body: RecurrenceWizardPayload.
 *   Calcola le date candidate senza modificare il DB (GAP-RECURRENCE-API-001, RB-11).
 *
 * Risposta: { turni: ShiftPreview[], conflicts: RecurrenceConflict[] }
 *   - ShiftPreview: { userId, date, shiftTypeId, shiftTypeName, shiftTypeColor, skipped, skipReason? }
 *   - RecurrenceConflict: { userId, date, reason: 'absence' | 'holiday' | 'overlap' }
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { absences, shiftTypes } from '@/db/schema';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { expandCandidates, recurrenceWizardSchema } from '@/lib/rules/expandRecurrenceCandidates';

export async function POST(req: Request): Promise<Response> {
  // ---- Auth ----------------------------------------------------------------
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  // ---- Parse body ----------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = recurrenceWizardSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);
  const p = parsed.data;

  // ---- Espandi candidati ---------------------------------------------------
  const candidates = expandCandidates(p);

  // ---- Assenze approvate nel range ----------------------------------------
  const absenceRows = await db
    .select({
      userId: absences.userId,
      startDate: absences.startDate,
      endDate: absences.endDate,
    })
    .from(absences)
    .where(
      and(
        inArray(absences.userId, p.userIds),
        eq(absences.status, 'approved'),
        lte(absences.startDate, p.endDate),
        gte(absences.endDate, p.startDate)
      )
    );

  // ---- Lookup shiftType per nome + colore ----------------------------------
  const stIds = [...new Set(candidates.map((c) => c.shiftTypeId))];
  const stRows =
    stIds.length > 0
      ? await db
          .select({ id: shiftTypes.id, name: shiftTypes.name, color: shiftTypes.color })
          .from(shiftTypes)
          .where(inArray(shiftTypes.id, stIds))
      : [];
  const stMap = new Map(stRows.map((s) => [s.id, s]));

  // ---- Costruisci risposta -------------------------------------------------
  const turni = candidates.map((c) => {
    const inAbsence = absenceRows.some(
      (a) => a.userId === c.userId && a.startDate <= c.date && a.endDate >= c.date
    );
    const st = stMap.get(c.shiftTypeId);
    return {
      userId: c.userId,
      date: c.date,
      shiftTypeId: c.shiftTypeId,
      shiftTypeName: st?.name ?? '',
      shiftTypeColor: st?.color ?? '#6B7280',
      skipped: inAbsence,
      ...(inAbsence ? { skipReason: 'absence' as const } : {}),
    };
  });

  const conflicts = turni
    .filter((t) => t.skipped && t.skipReason)
    .map((t) => ({ userId: t.userId, date: t.date, reason: t.skipReason! }));

  return ApiResponse.ok({ turni, conflicts });
}
