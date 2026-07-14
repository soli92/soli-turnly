/**
 * app/api/admin/reports/overtime/route.ts — Report straordinari (admin) (TSK-027).
 *
 * GET /api/admin/reports/overtime?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=<uuid|undefined>
 *
 * Admin only (403 per dipendenti).
 *
 * Calcolo ore:
 *   - Per ogni dipendente nel range (o solo il userId specificato):
 *     1. Recupera tutti i turni non-cancelled WHERE date BETWEEN from AND to
 *     2. Raggruppa per settimana ISO
 *     3. Per ogni settimana: ordinaryMinutes = min(weekMin, contractHours*60)
 *                            overtimeMinutes = max(0, weekMin - contractHours*60)
 *     4. Somma su tutte le settimane → ore totali con 2 decimali
 *   - overtimeExceedsThreshold se overtimeHours > 40 (maxStraordinarioMensileOre, RB-06)
 *
 * Response:
 *   { data: OvertimeReportRow[], period: { from, to }, generatedAt: ISO }
 *
 * Paginazione: page + limit (default 50), ordinamento per overtimeHours desc.
 *
 * Closes gap G-007.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, users, qualifications } from '@/db/schema';
import { and, eq, gte, lte, ne, type SQL } from 'drizzle-orm';
import { differenceInMinutes, startOfISOWeek } from 'date-fns';
import { ApiResponse } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Costanti di business (RB-06)
// ---------------------------------------------------------------------------

const MAX_STRAORDINARIO_MENSILE_ORE = 40;

// ---------------------------------------------------------------------------
// Tipo risposta riga
// ---------------------------------------------------------------------------

export interface OvertimeReportRow {
  userId: string;
  firstName: string;
  lastName: string;
  qualificationName: string | null;
  contractHours: number;
  ordinaryHours: number;
  overtimeHours: number;
  totalHours: number;
  overtimeExceedsThreshold: boolean;
}

// ---------------------------------------------------------------------------
// Tipo risposta completa
// ---------------------------------------------------------------------------

export interface OvertimeReportResponse {
  data: OvertimeReportRow[];
  period: { from: string; to: string };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helper: calcola ore ordinarie + straordinarie per un utente dato i suoi turni
// Raggruppa per settimana ISO (allineato con calculateOvertime.ts, RB-06).
// ---------------------------------------------------------------------------

interface ShiftMinimal {
  startDt: Date;
  endDt: Date;
}

function calculateOvertimeForPeriod(
  userShifts: ShiftMinimal[],
  contractHoursPerWeek: number
): { ordinaryMinutes: number; overtimeMinutes: number } {
  if (userShifts.length === 0) return { ordinaryMinutes: 0, overtimeMinutes: 0 };

  // Raggruppa turni per chiave settimana ISO (lunedì della settimana come stringa)
  const weekMap = new Map<string, number>(); // weekKey → totalMinutes

  for (const shift of userShifts) {
    const weekStart = startOfISOWeek(shift.startDt);
    const weekKey = weekStart.toISOString();
    // differenceInMinutes (troncamento) — allineato a calculateOvertime.ts (RB-06) per
    // eliminare lo scarto ±1 min tra report e validazione turni (fix TSK-027).
    const shiftMinutes = Math.max(0, differenceInMinutes(shift.endDt, shift.startDt));
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + shiftMinutes);
  }

  let totalOrdinaryMinutes = 0;
  let totalOvertimeMinutes = 0;
  const contractMinutesPerWeek = contractHoursPerWeek * 60;

  for (const weekMinutes of weekMap.values()) {
    totalOrdinaryMinutes += Math.min(weekMinutes, contractMinutesPerWeek);
    totalOvertimeMinutes += Math.max(0, weekMinutes - contractMinutesPerWeek);
  }

  return {
    ordinaryMinutes: totalOrdinaryMinutes,
    overtimeMinutes: totalOvertimeMinutes,
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/reports/overtime
// ---------------------------------------------------------------------------

export async function GET(req: Request): Promise<Response> {
  // ---- Auth ----------------------------------------------------------------
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  // ---- Parametri -----------------------------------------------------------
  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const userIdParam = url.searchParams.get('userId') ?? undefined;

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const offset = (page - 1) * limit;

  // ---- Validazione date ----------------------------------------------------
  if (!fromParam || !toParam) {
    return ApiResponse.badRequest('I parametri from e to sono obbligatori (YYYY-MM-DD)');
  }

  const fromDate = new Date(fromParam + 'T00:00:00.000Z');
  const toDate = new Date(toParam + 'T23:59:59.999Z');

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return ApiResponse.badRequest('Formato data non valido — atteso YYYY-MM-DD');
  }

  if (fromDate >= toDate) {
    return ApiResponse.badRequest('from deve precedere to');
  }

  // ---- Query turni nel periodo ---------------------------------------------
  // Recupera tutti i turni non-cancelled nel range con dati utente + qualifica

  const shiftConditions: SQL[] = [
    ne(shifts.status, 'cancelled'),
    gte(shifts.startDt, fromDate),
    lte(shifts.startDt, toDate),
  ];
  if (userIdParam) {
    shiftConditions.push(eq(shifts.userId, userIdParam));
  }

  const rawShifts = await db
    .select({
      shiftId: shifts.id,
      userId: shifts.userId,
      startDt: shifts.startDt,
      endDt: shifts.endDt,
      firstName: users.firstName,
      lastName: users.lastName,
      qualificationId: users.qualificationId,
      contractHours: users.contractHours,
      qualificationName: qualifications.name,
    })
    .from(shifts)
    .innerJoin(users, eq(shifts.userId, users.id))
    .leftJoin(qualifications, eq(users.qualificationId, qualifications.id))
    .where(and(...shiftConditions));

  // ---- Aggregazione per utente ---------------------------------------------
  const userMap = new Map<
    string,
    {
      userId: string;
      firstName: string;
      lastName: string;
      qualificationName: string | null;
      contractHours: number;
      shiftsData: ShiftMinimal[];
    }
  >();

  for (const row of rawShifts) {
    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, {
        userId: row.userId,
        firstName: row.firstName,
        lastName: row.lastName,
        qualificationName: row.qualificationName ?? null,
        contractHours: row.contractHours,
        shiftsData: [],
      });
    }
    const entry = userMap.get(row.userId)!;
    entry.shiftsData.push({ startDt: row.startDt, endDt: row.endDt });
  }

  // ---- Calcolo overtime per utente ----------------------------------------
  const results: OvertimeReportRow[] = [];

  for (const entry of userMap.values()) {
    const { ordinaryMinutes, overtimeMinutes } = calculateOvertimeForPeriod(
      entry.shiftsData,
      entry.contractHours
    );

    const ordinaryHours = parseFloat((ordinaryMinutes / 60).toFixed(2));
    const overtimeHours = parseFloat((overtimeMinutes / 60).toFixed(2));
    const totalHours = parseFloat(((ordinaryMinutes + overtimeMinutes) / 60).toFixed(2));

    results.push({
      userId: entry.userId,
      firstName: entry.firstName,
      lastName: entry.lastName,
      qualificationName: entry.qualificationName,
      contractHours: entry.contractHours,
      ordinaryHours,
      overtimeHours,
      totalHours,
      overtimeExceedsThreshold: overtimeHours > MAX_STRAORDINARIO_MENSILE_ORE,
    });
  }

  // ---- Ordinamento: overtimeHours desc (dipendente con più straordinario in cima) ----
  results.sort((a, b) => b.overtimeHours - a.overtimeHours);

  // ---- Paginazione ---------------------------------------------------------
  const paginated = results.slice(offset, offset + limit);

  const response: OvertimeReportResponse = {
    data: paginated,
    period: { from: fromParam, to: toParam },
    generatedAt: new Date().toISOString(),
  };

  return ApiResponse.ok(response);
}
