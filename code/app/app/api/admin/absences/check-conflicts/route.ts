/**
 * app/api/admin/absences/check-conflicts/route.ts — Dry-run conflitti assenza (TSK-017).
 *
 * POST /api/admin/absences/check-conflicts
 * Body: { userId, startDate, endDate }
 * Response: { shifts: ShiftConflict[] }
 *
 * Individua i turni pianificati/confermati di un dipendente che si sovrappongono
 * al range date dell'assenza da registrare (RF-G CA2).
 * Non scrive nulla sul DB — solo lettura (dry-run).
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, shiftTypes, users } from '@/db/schema';
import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { checkConflictsSchema } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipo risposta — ShiftConflict serializzabile verso il client FE
// ---------------------------------------------------------------------------

export interface ShiftConflict {
  id: string;
  date: string; // YYYY-MM-DD
  startDt: string; // ISO 8601
  endDt: string; // ISO 8601
  shiftTypeName: string | null;
  shiftTypeCode: string | null;
  shiftTypeColor: string | null;
  userFirstName: string;
  userLastName: string;
  status: 'planned' | 'confirmed' | 'cancelled';
}

// =============================================================
// POST /api/admin/absences/check-conflicts
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

  const parsed = checkConflictsSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { userId, startDate, endDate } = parsed.data;

  // Cerca turni del dipendente che cadono (anche parzialmente) nel range assenza.
  // Un turno è in conflitto se la sua `date` cade in [startDate, endDate].
  // I turni cancellati non sono considerati conflitto.
  const conflictingShifts = await db
    .select({
      id: shifts.id,
      date: shifts.date,
      startDt: shifts.startDt,
      endDt: shifts.endDt,
      status: shifts.status,
      shiftTypeName: shiftTypes.name,
      shiftTypeCode: shiftTypes.code,
      shiftTypeColor: shiftTypes.color,
      userFirstName: users.firstName,
      userLastName: users.lastName,
    })
    .from(shifts)
    .leftJoin(shiftTypes, eq(shifts.shiftTypeId, shiftTypes.id))
    .innerJoin(users, eq(shifts.userId, users.id))
    .where(
      and(
        eq(shifts.userId, userId),
        gte(shifts.date, startDate),
        lte(shifts.date, endDate),
        ne(shifts.status, 'cancelled')
      )
    )
    .orderBy(shifts.date, shifts.startDt);

  const result: ShiftConflict[] = conflictingShifts.map((row) => ({
    id: row.id,
    date: row.date as string,
    startDt: row.startDt.toISOString(),
    endDt: row.endDt.toISOString(),
    shiftTypeName: row.shiftTypeName ?? null,
    shiftTypeCode: row.shiftTypeCode ?? null,
    shiftTypeColor: row.shiftTypeColor ?? null,
    userFirstName: row.userFirstName,
    userLastName: row.userLastName,
    status: row.status as 'planned' | 'confirmed' | 'cancelled',
  }));

  return ApiResponse.ok({ shifts: result });
}
