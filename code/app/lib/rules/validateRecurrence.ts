/**
 * RB-11 — Generazione turno da ricorrenza: skip assenze approvate e festivi.
 *
 * Filtra le date candidate della ricorrenza eliminando:
 * - date che cadono in un'assenza approvata dell'utente
 * - date che coincidono con un giorno festivo (lista fornita)
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Absence } from './types';

export type SkipReason = 'absence' | 'holiday';

export interface RecurrenceCandidate {
  date: Date;
}

export interface RecurrenceSkipped {
  date: Date;
  reason: SkipReason;
  detail?: string;
}

export interface RecurrenceResult {
  valid: RecurrenceCandidate[];
  skipped: RecurrenceSkipped[];
}

/**
 * Filtra le date candidate della ricorrenza per un utente.
 *
 * @param userId     - ID dell'utente per cui si genera la ricorrenza.
 * @param candidates - Date candidate generate dalla regola di ricorrenza.
 * @param absences   - Assenze dell'utente (tutte le assenze; filtra per userId e status).
 * @param holidays   - Giorni festivi (YYYY-MM-DD) da saltare.
 */
export function validateRecurrence(
  userId: string,
  candidates: Date[],
  absences: Absence[],
  holidays: string[] = [],
): RecurrenceResult {
  const approvedAbsences = absences.filter(
    (a) => a.userId === userId && a.status === 'approved',
  );
  const holidaySet = new Set(holidays);

  const valid: RecurrenceCandidate[] = [];
  const skipped: RecurrenceSkipped[] = [];

  for (const date of candidates) {
    const dayKey = startOfDay(date).toISOString().slice(0, 10);

    // Controlla festivo
    if (holidaySet.has(dayKey)) {
      skipped.push({ date, reason: 'holiday', detail: dayKey });
      continue;
    }

    // Controlla assenza approvata
    const conflict = approvedAbsences.find((a) =>
      isWithinInterval(startOfDay(date), {
        start: startOfDay(parseISO(a.startDate)),
        end: startOfDay(parseISO(a.endDate)),
      }),
    );

    if (conflict) {
      skipped.push({
        date,
        reason: 'absence',
        detail: `assenza ${conflict.id} (${conflict.startDate}–${conflict.endDate})`,
      });
      continue;
    }

    valid.push({ date });
  }

  return { valid, skipped };
}
