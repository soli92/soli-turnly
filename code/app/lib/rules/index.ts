/**
 * lib/rules/index.ts — Barrel export del motore regole di business.
 *
 * Esporta tutte le pure functions e la funzione composita validateShift()
 * che aggrega RB-01..RB-09 in un'unica chiamata.
 *
 * Usabile sia da FE (feedback ottimistico) sia da BE (autorità T-INT-01).
 */

// --- Tipi ---
export type {
  Absence,
  AvailabilityEntry,
  CoverageRequirement,
  ExistingShift,
  PlannedShift,
  RuleId,
  RuleViolation,
  Severity,
  ShiftInput,
  ValidationResult,
} from './types';
export { emptyResult, mergeResults, addViolation } from './types';

// --- Regole RB-01..RB-17 ---
export { validateNoOverlap } from './validateNoOverlap';
export { validateMinRest } from './validateMinRest';
export { validateWeeklyRest } from './validateWeeklyRest';
export { validateConsecutiveDays } from './validateConsecutiveDays';
export { validateWeeklyHours } from './validateWeeklyHours';
export { calculateOvertime } from './calculateOvertime';
export { validateCoverage } from './validateCoverage';
export { validateNoShiftOnAbsence } from './validateNoShiftOnAbsence';
export { validatePastShift } from './validatePastShift';
export { validateSwap } from './validateSwap';
export type { SwapInput } from './validateSwap';
export { validateRecurrence } from './validateRecurrence';
export type { RecurrenceResult, RecurrenceSkipped, SkipReason } from './validateRecurrence';
export {
  calculateShiftDurationMinutes,
  calculateShiftDurationHours,
} from './calculateShiftDuration';
export { validateContractFields } from './validateContractFields';
export { validateRequestApproval } from './validateRequestApproval';
export type { ApprovalContext } from './validateRequestApproval';
export { validateAvailabilityConflict } from './validateAvailabilityConflict';
export { validateRequestImmutability } from './validateRequestImmutability';
export type { MutationAction } from './validateRequestImmutability';
export { validateLeaveNotice } from './validateLeaveNotice';

// --- Funzione composita ---
import type { Absence, ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult, mergeResults } from './types';
import { validateNoOverlap } from './validateNoOverlap';
import { validateMinRest } from './validateMinRest';
import { validateWeeklyRest } from './validateWeeklyRest';
import { validateConsecutiveDays } from './validateConsecutiveDays';
import { validateWeeklyHours } from './validateWeeklyHours';
import { validateNoShiftOnAbsence } from './validateNoShiftOnAbsence';
import { validatePastShift } from './validatePastShift';

export interface ValidateShiftContext {
  existingShifts: ExistingShift[];
  absences: Absence[];
  contractHours?: number;
  /** Punto di riferimento temporale (iniettabile per i test). */
  now?: Date;
}

/**
 * Funzione composita: applica RB-01..RB-09 in sequenza e aggrega i risultati.
 *
 * Usata dal BE come punto di validazione autoritativo prima di ogni
 * creazione/modifica turno (T-INT-01).
 *
 * @param input   - Dati del turno da creare o modificare.
 * @param context - Turni esistenti e assenze correnti dell'utente.
 */
export function validateShift(
  input: ShiftInput,
  context: ValidateShiftContext,
): ValidationResult {
  const { existingShifts, absences, now } = context;
  let result = emptyResult();

  result = mergeResults(result, validateNoOverlap(input, existingShifts));         // RB-01
  result = mergeResults(result, validateMinRest(input, existingShifts));           // RB-02
  result = mergeResults(result, validateWeeklyRest(input, existingShifts));        // RB-03
  result = mergeResults(result, validateConsecutiveDays(input, existingShifts));   // RB-04
  result = mergeResults(result, validateWeeklyHours(input, existingShifts));       // RB-05
  // RB-06 (overtime) è informativo, non incluso nel gate di default
  // RB-07 (coverage) richiede requirements — non incluso nel gate generico
  result = mergeResults(result, validateNoShiftOnAbsence(input, absences));        // RB-08
  result = mergeResults(result, validatePastShift(input, now));                    // RB-09

  return result;
}
