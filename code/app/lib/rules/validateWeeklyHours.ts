/**
 * RB-05 — Ore settimanali: soft cap 40h (WARNING), hard cap 48h (BLOCKING).
 *
 * Calcola le ore totali nella settimana ISO del nuovo turno (incluso il nuovo).
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { differenceInMinutes, endOfISOWeek, startOfISOWeek } from 'date-fns';
import type { ExistingShift, RuleViolation, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

const SOFT_CAP_HOURS = 40;
const HARD_CAP_HOURS = 48;

function minutesToHoursFixed(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

/**
 * Verifica che le ore totali nella settimana ISO del turno non superino
 * il soft cap (40h WARNING) né l'hard cap (48h BLOCKING).
 */
export function validateWeeklyHours(
  input: ShiftInput,
  existing: ExistingShift[]
): ValidationResult {
  const result = emptyResult();

  const weekStart = startOfISOWeek(input.startDt);
  const weekEnd = endOfISOWeek(input.startDt);

  // Tutti i turni dello stesso utente nella stessa settimana ISO
  const weekShifts = existing.filter(
    (s) =>
      s.userId === input.userId &&
      s.id !== input.id &&
      s.startDt >= weekStart &&
      s.startDt <= weekEnd
  );

  // Somma minuti esistenti + nuovo turno
  const existingMinutes = weekShifts.reduce(
    (acc, s) => acc + differenceInMinutes(s.endDt, s.startDt),
    0
  );
  const newMinutes = differenceInMinutes(input.endDt, input.startDt);
  const totalMinutes = existingMinutes + newMinutes;
  const totalHours = totalMinutes / 60;

  if (totalHours > HARD_CAP_HOURS) {
    const v: RuleViolation = {
      ruleId: 'RB-05',
      severity: 'blocking',
      message: `Ore settimanali eccedono il limite massimo: ${minutesToHoursFixed(totalMinutes)}h (hard cap ${HARD_CAP_HOURS}h)`,
      affectedUserId: input.userId,
    };
    result.valid = false;
    result.blocking.push(v);
  } else if (totalHours > SOFT_CAP_HOURS) {
    result.warnings.push({
      ruleId: 'RB-05',
      severity: 'warning',
      message: `Ore settimanali sopra il cap raccomandato: ${minutesToHoursFixed(totalMinutes)}h (soft cap ${SOFT_CAP_HOURS}h)`,
      affectedUserId: input.userId,
    });
  }

  return result;
}
