/**
 * RB-08 — Nessun turno durante un'assenza approvata.
 * Severity: BLOCKING
 *
 * Confronta le date del turno con le assenze approvate dell'utente.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { Absence, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica che il turno non cada durante un'assenza con status "approved".
 */
export function validateNoShiftOnAbsence(input: ShiftInput, absences: Absence[]): ValidationResult {
  const result = emptyResult();

  const approved = absences.filter((a) => a.userId === input.userId && a.status === 'approved');

  for (const absence of approved) {
    const absenceStart = startOfDay(parseISO(absence.startDate));
    const absenceEnd = startOfDay(parseISO(absence.endDate));

    // Controlla se almeno uno dei giorni del turno ricade nell'assenza
    const shiftDay = startOfDay(input.startDt);

    if (isWithinInterval(shiftDay, { start: absenceStart, end: absenceEnd })) {
      result.valid = false;
      result.blocking.push({
        ruleId: 'RB-08',
        severity: 'blocking',
        message: `Turno in conflitto con assenza approvata (${absence.startDate} – ${absence.endDate}, id: ${absence.id})`,
        affectedUserId: input.userId,
      });
      break;
    }
  }

  return result;
}
