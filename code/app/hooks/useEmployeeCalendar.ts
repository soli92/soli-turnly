'use client';

/**
 * hooks/useEmployeeCalendar.ts — TanStack Query hook per il calendario dipendente.
 *
 * Consuma:
 *   GET /api/shifts?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 *
 * Il backend (T-SEC-01) filtra automaticamente per userId = session.user.id
 * per i ruoli non-admin: il dipendente vede solo i propri turni.
 *
 * L'hook espone:
 *   - shifts: ShiftRow[]  (trasformati in ShiftCalendarEvent dal componente)
 *   - totalHours: number  (ore totali nel periodo — DST-safe)
 *   - overtimeHours: number (ore extra su contractHours settimanali)
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { parseISO, startOfISOWeek } from 'date-fns';
import { getDurationHours } from '@/lib/date';
import { calculateOvertime } from '@/lib/rules/calculateOvertime';
import type { ExistingShift, ShiftInput } from '@/lib/rules/types';
import type { ShiftRow } from '@/types';

// ---------------------------------------------------------------------------
// Tipi pubblici
// ---------------------------------------------------------------------------

export interface ShiftCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ShiftRow;
  color: string;
}

export interface EmployeeCalendarData {
  events: ShiftCalendarEvent[];
  totalHours: number;
  overtimeHours: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const employeeCalendarKeys = {
  all: ['employee-calendar'] as const,
  byRange: (from: string, to: string) => ['employee-calendar', 'range', from, to] as const,
};

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface ShiftsApiResponse {
  data: ShiftRow[];
}

async function fetchEmployeeShifts(from: string, to: string): Promise<ShiftRow[]> {
  const params = new URLSearchParams({ dateFrom: from, dateTo: to, limit: '200' });
  const res = await fetch(`/api/shifts?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Errore fetch turni dipendente: ${res.status} ${res.statusText}`);
  }
  const json: ShiftsApiResponse = await res.json();
  return json.data;
}

// ---------------------------------------------------------------------------
// Trasforma ShiftRow[] → ShiftCalendarEvent[]
// ---------------------------------------------------------------------------

function toCalendarEvents(shifts: ShiftRow[]): ShiftCalendarEvent[] {
  return shifts.map((shift) => ({
    id: shift.id,
    title: shift.shiftTypeName ?? 'Turno',
    start: parseISO(shift.startDt),
    end: parseISO(shift.endDt),
    resource: shift,
    // Colore tipologia — fallback primary se shiftTypeColor non disponibile
    color: shift.shiftTypeColor ?? '#2563eb',
  }));
}

// ---------------------------------------------------------------------------
// Calcola ore del periodo (DST-safe, RB-12)
// ---------------------------------------------------------------------------

function computeHours(
  shifts: ShiftRow[],
  contractHoursPerWeek: number
): { totalHours: number; overtimeHours: number } {
  const totalHours = shifts.reduce(
    (acc, s) => acc + getDurationHours(parseISO(s.startDt), parseISO(s.endDt)),
    0
  );

  // Group shifts by ISO week, then apply RB-06 per week (calculateOvertime).
  const byWeek = new Map<string, ShiftRow[]>();
  for (const s of shifts) {
    const key = startOfISOWeek(parseISO(s.startDt)).toISOString();
    byWeek.set(key, [...(byWeek.get(key) ?? []), s]);
  }

  let overtimeHours = 0;
  for (const weekShifts of byWeek.values()) {
    const [first, ...rest] = weekShifts;
    if (!first) continue;
    const inp: ShiftInput = {
      userId: first.userId,
      startDt: parseISO(first.startDt),
      endDt: parseISO(first.endDt),
      id: first.id,
    };
    const existing: ExistingShift[] = rest.map((s) => ({
      id: s.id,
      userId: s.userId,
      startDt: parseISO(s.startDt),
      endDt: parseISO(s.endDt),
    }));
    const result = calculateOvertime(inp, existing, contractHoursPerWeek);
    // RB-06 message format: "Straordinario stimato: X.Xh sopra le Yh contrattuali questa settimana"
    const m = result.info[0]?.message.match(/^Straordinario stimato: ([\d.]+)h/);
    overtimeHours += m ? parseFloat(m[1] ?? '0') : 0;
  }

  return { totalHours, overtimeHours };
}

// ---------------------------------------------------------------------------
// useEmployeeCalendar — hook principale
// ---------------------------------------------------------------------------

/**
 * Fetcha i turni del dipendente autenticato per il range [from, to].
 *
 * @param from               - Inizio periodo (YYYY-MM-DD)
 * @param to                 - Fine periodo (YYYY-MM-DD)
 * @param contractHoursPerWeek - Ore contrattuali/settimana (default 40)
 * @param options            - Opzioni aggiuntive useQuery (es. initialData)
 */
export function useEmployeeCalendar(
  from: string,
  to: string,
  contractHoursPerWeek = 40,
  options?: Partial<UseQueryOptions<ShiftRow[]>>
) {
  const query = useQuery<ShiftRow[]>({
    queryKey: employeeCalendarKeys.byRange(from, to),
    queryFn: () => fetchEmployeeShifts(from, to),
    staleTime: 60 * 1000,
    ...options,
  });

  const events = query.data ? toCalendarEvents(query.data) : [];

  const { totalHours, overtimeHours } = query.data
    ? computeHours(query.data, contractHoursPerWeek)
    : { totalHours: 0, overtimeHours: 0 };

  return {
    ...query,
    events,
    totalHours,
    overtimeHours,
  };
}
