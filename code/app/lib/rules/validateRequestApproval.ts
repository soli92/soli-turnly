/**
 * RB-14 — Rivalidazione delle regole al momento dell'approvazione di una richiesta.
 *
 * Quando un admin approva una richiesta shift-swap o availability, le condizioni
 * potrebbero essere cambiate dall'invio. Questo modulo re-applica le regole
 * rilevanti per garantire che l'approvazione sia ancora valida.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import type { Absence, ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult, mergeResults } from './types';
import { validateNoOverlap } from './validateNoOverlap';
import { validateMinRest } from './validateMinRest';
import { validateWeeklyRest } from './validateWeeklyRest';
import { validateConsecutiveDays } from './validateConsecutiveDays';
import { validateWeeklyHours } from './validateWeeklyHours';
import { validateNoShiftOnAbsence } from './validateNoShiftOnAbsence';

export interface ApprovalContext {
  existingShifts: ExistingShift[];
  absences: Absence[];
  contractHours?: number;
}

/**
 * Rivalida un turno al momento dell'approvazione applicando RB-01..08.
 *
 * @param shiftToApprove - Turno che verrà creato/confermato dall'approvazione.
 * @param context        - Contesto aggiornato (turni e assenze correnti).
 */
export function validateRequestApproval(
  shiftToApprove: ShiftInput,
  context: ApprovalContext
): ValidationResult {
  let result = emptyResult();

  result = mergeResults(result, validateNoOverlap(shiftToApprove, context.existingShifts));
  result = mergeResults(result, validateMinRest(shiftToApprove, context.existingShifts));
  result = mergeResults(result, validateWeeklyRest(shiftToApprove, context.existingShifts));
  result = mergeResults(result, validateConsecutiveDays(shiftToApprove, context.existingShifts));
  result = mergeResults(result, validateWeeklyHours(shiftToApprove, context.existingShifts));
  result = mergeResults(result, validateNoShiftOnAbsence(shiftToApprove, context.absences));

  return result;
}
