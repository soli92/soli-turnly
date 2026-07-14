/**
 * RB-06 — Calcola ore straordinarie (ore sopra contractHours settimanali).
 * Severity: INFO
 *
 * Restituisce un ValidationResult con severity 'info' e il dettaglio
 * delle ore extra rispetto al contratto.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { differenceInMinutes, endOfISOWeek, startOfISOWeek } from 'date-fns';
import type { ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

const DEFAULT_CONTRACT_HOURS = 40;

/**
 * Calcola le ore straordinarie nella settimana ISO del turno in input.
 *
 * @param input          - Turno da aggiungere.
 * @param existing       - Turni esistenti dell'utente.
 * @param contractHours  - Ore contrattuali settimanali (default 40).
 */
export function calculateOvertime(
  input: ShiftInput,
  existing: ExistingShift[],
  contractHours: number = DEFAULT_CONTRACT_HOURS
): ValidationResult {
  const result = emptyResult();

  const weekStart = startOfISOWeek(input.startDt);
  const weekEnd = endOfISOWeek(input.startDt);

  const weekShifts = existing.filter(
    (s) =>
      s.userId === input.userId &&
      s.id !== input.id &&
      s.startDt >= weekStart &&
      s.startDt <= weekEnd
  );

  const existingMinutes = weekShifts.reduce(
    (acc, s) => acc + differenceInMinutes(s.endDt, s.startDt),
    0
  );
  const newMinutes = differenceInMinutes(input.endDt, input.startDt);
  const totalMinutes = existingMinutes + newMinutes;
  const totalHours = totalMinutes / 60;

  const overtimeHours = totalHours - contractHours;

  if (overtimeHours > 0) {
    result.info.push({
      ruleId: 'RB-06',
      severity: 'info',
      message: `Straordinario stimato: ${overtimeHours.toFixed(1)}h sopra le ${contractHours}h contrattuali questa settimana`,
      affectedUserId: input.userId,
    });
  }

  return result;
}
