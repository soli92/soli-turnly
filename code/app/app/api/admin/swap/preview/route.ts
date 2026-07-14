/**
 * app/api/admin/swap/preview/route.ts — Anteprima scambio turni (TSK-026).
 *
 * GET /api/admin/swap/preview?shiftAId=<uuid>&shiftBId=<uuid>
 *   - Admin only.
 *   - Esegue validateSwap (RB-10) senza modificare il DB.
 *   - Usato da SwapImpactPreview per mostrare l'esito prima della conferma.
 *
 * Risposta:
 *   { valid, blocking: ViolationItem[], warnings: ViolationItem[], info: ViolationItem[] }
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, absences } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { validateSwap } from '@/lib/rules/validateSwap';

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const url = new URL(req.url);
  const shiftAId = url.searchParams.get('shiftAId');
  const shiftBId = url.searchParams.get('shiftBId');

  if (!shiftAId || !shiftBId) {
    return ApiResponse.badRequest('Parametri shiftAId e shiftBId obbligatori');
  }

  // Validazione UUID base
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(shiftAId) || !uuidRegex.test(shiftBId)) {
    return ApiResponse.badRequest('shiftAId e shiftBId devono essere UUID validi');
  }

  if (shiftAId === shiftBId) {
    return ApiResponse.badRequest('I due turni devono essere diversi');
  }

  // Recupera i due turni
  const [shiftA] = await db.select().from(shifts).where(eq(shifts.id, shiftAId)).limit(1);
  if (!shiftA) return ApiResponse.notFound(`Turno A (${shiftAId}) non trovato`);

  const [shiftB] = await db.select().from(shifts).where(eq(shifts.id, shiftBId)).limit(1);
  if (!shiftB) return ApiResponse.notFound(`Turno B (${shiftBId}) non trovato`);

  // I turni devono appartenere a dipendenti diversi
  if (shiftA.userId === shiftB.userId) {
    return ApiResponse.badRequest('I turni devono appartenere a dipendenti diversi');
  }

  // Recupera tutti i turni di entrambi gli utenti
  const allShiftsRows = await db
    .select()
    .from(shifts)
    .where(inArray(shifts.userId, [shiftA.userId, shiftB.userId]));

  // Recupera le assenze di entrambi gli utenti
  const absencesRows = await db
    .select()
    .from(absences)
    .where(inArray(absences.userId, [shiftA.userId, shiftB.userId]));

  // Prepara i dati per validateSwap (startDt/endDt come Date)
  const toExistingShift = (s: typeof shiftA) => ({
    id: s.id,
    userId: s.userId,
    startDt: new Date(s.startDt),
    endDt: new Date(s.endDt),
  });

  const result = validateSwap({
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

  return ApiResponse.ok({
    valid: result.valid,
    blocking: result.blocking,
    warnings: result.warnings,
    info: result.info,
  });
}
