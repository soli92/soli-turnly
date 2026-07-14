/**
 * app/api/admin/recurrence/generate/route.ts — Genera turni da wizard ricorrenza.
 *
 * POST /api/admin/recurrence/generate
 *   Admin only. Body: RecurrenceWizardPayload.
 *   Crea i turni nel DB escludendo le date con assenze approvate (RB-11, T-DOM-08).
 *
 * Risposta: { generated: number, skipped: number, status: 'done' }
 *
 * GAP-RECURRENCE-API-001
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { absences, shifts, shiftTypes } from '@/db/schema';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { TZDate } from '@date-fns/tz';
import { ApiResponse } from '@/lib/api-response';
import { APP_TIMEZONE } from '@/lib/date';
import { expandCandidates, recurrenceWizardSchema } from '@/lib/rules/expandRecurrenceCandidates';

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

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
  if (candidates.length === 0) return ApiResponse.ok({ generated: 0, skipped: 0, status: 'done' });

  // ---- Assenze approvate nel range (RB-11) ---------------------------------
  const absenceRows = await db
    .select({ userId: absences.userId, startDate: absences.startDate, endDate: absences.endDate })
    .from(absences)
    .where(
      and(
        inArray(absences.userId, p.userIds),
        eq(absences.status, 'approved'),
        lte(absences.startDate, p.endDate),
        gte(absences.endDate, p.startDate)
      )
    );

  // ---- Lookup shiftType per orari (DST-safe startDt/endDt) ----------------
  const stIds = [...new Set(candidates.map((c) => c.shiftTypeId))];
  const stRows = await db
    .select({
      id: shiftTypes.id,
      defaultStartTime: shiftTypes.defaultStartTime,
      defaultEndTime: shiftTypes.defaultEndTime,
    })
    .from(shiftTypes)
    .where(inArray(shiftTypes.id, stIds));
  const stMap = new Map(stRows.map((s) => [s.id, s]));

  // ---- Filtra conflitti assenze e costruisce valori turno ------------------
  const now = new Date();
  const adminId = session.user.id as string;
  const skippedCount = candidates.filter((c) =>
    absenceRows.some((a) => a.userId === c.userId && a.startDate <= c.date && a.endDate >= c.date)
  ).length;

  const shiftValues = candidates.flatMap((c) => {
    const inAbsence = absenceRows.some(
      (a) => a.userId === c.userId && a.startDate <= c.date && a.endDate >= c.date
    );
    if (inAbsence) return [];
    const st = stMap.get(c.shiftTypeId);
    if (!st) return [];
    const [yr, mo, dy] = c.date.split('-').map(Number);
    const y = yr ?? 0;
    const mm = (mo ?? 1) - 1; // TZDate.tz usa mesi 0-indexed
    const d = dy ?? 1;
    const s = parseTime(st.defaultStartTime);
    const e = parseTime(st.defaultEndTime);
    const startDt = new Date(TZDate.tz(APP_TIMEZONE, y, mm, d, s.h, s.m, 0, 0).getTime());
    // Turno notturno (attraversa mezzanotte): endDt nel giorno successivo (T-DOM-08)
    let endDt = new Date(TZDate.tz(APP_TIMEZONE, y, mm, d, e.h, e.m, 0, 0).getTime());
    if (endDt <= startDt) {
      endDt = new Date(TZDate.tz(APP_TIMEZONE, y, mm, d + 1, e.h, e.m, 0, 0).getTime());
    }
    return [
      {
        userId: c.userId,
        shiftTypeId: c.shiftTypeId,
        date: c.date,
        startDt,
        endDt,
        origin: 'recurrence' as const,
        status: 'planned' as const,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  if (shiftValues.length === 0) {
    return ApiResponse.ok({ generated: 0, skipped: candidates.length, status: 'done' });
  }

  // ---- Inserimento batch ---------------------------------------------------
  const inserted = await db.insert(shifts).values(shiftValues).returning({ id: shifts.id });

  return ApiResponse.ok({ generated: inserted.length, skipped: skippedCount, status: 'done' });
}
