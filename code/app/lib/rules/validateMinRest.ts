/**
 * RB-02 — Riposo minimo 11 ore tra turni consecutivi dello stesso utente.
 * Severity: WARNING di default; BLOCKING se options.strict = true.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * La configurazione viene iniettata tramite il parametro opzionale `options`
 * anziché letta da process.env, garantendo la purezza anche su client.
 * Il chiamante BE (route handler) può passare:
 *   { strict: process.env['MIN_REST_STRICT'] === 'true' }
 */
import { differenceInHours } from 'date-fns';
import type { ExistingShift, RuleViolation, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

const MIN_REST_HOURS = 11;

/**
 * Verifica il riposo minimo di 11 ore tra il turno in input e i turni
 * adiacenti (precedente e successivo) dello stesso utente.
 *
 * @param options.strict - true → severity BLOCKING; false (default) → WARNING
 */
export function validateMinRest(
  input: ShiftInput,
  existing: ExistingShift[],
  options?: { strict?: boolean | undefined }
): ValidationResult {
  const result = emptyResult();
  const severity = (options?.strict ?? false) ? 'blocking' : 'warning';

  const sameUserShifts = existing.filter((s) => s.userId === input.userId && s.id !== input.id);

  // Turno precedente: il più recente che termina prima dell'inizio del nuovo
  const before = sameUserShifts
    .filter((s) => s.endDt <= input.startDt)
    .sort((a, b) => b.endDt.getTime() - a.endDt.getTime())[0];

  if (before) {
    const restHours = differenceInHours(input.startDt, before.endDt);
    if (restHours < MIN_REST_HOURS) {
      const v: RuleViolation = {
        ruleId: 'RB-02',
        severity,
        message: `Riposo insufficiente: ${restHours}h tra turno ${before.id} e il nuovo turno (minimo ${MIN_REST_HOURS}h)`,
        affectedUserId: input.userId,
      };
      if (severity === 'blocking') {
        result.valid = false;
        result.blocking.push(v);
      } else {
        result.warnings.push(v);
      }
    }
  }

  // Turno successivo: il meno recente che inizia dopo la fine del nuovo
  const after = sameUserShifts
    .filter((s) => s.startDt >= input.endDt)
    .sort((a, b) => a.startDt.getTime() - b.startDt.getTime())[0];

  if (after) {
    const restHours = differenceInHours(after.startDt, input.endDt);
    if (restHours < MIN_REST_HOURS) {
      const v: RuleViolation = {
        ruleId: 'RB-02',
        severity,
        message: `Riposo insufficiente: ${restHours}h tra il nuovo turno e turno ${after.id} (minimo ${MIN_REST_HOURS}h)`,
        affectedUserId: input.userId,
      };
      if (severity === 'blocking') {
        result.valid = false;
        result.blocking.push(v);
      } else {
        result.warnings.push(v);
      }
    }
  }

  return result;
}
