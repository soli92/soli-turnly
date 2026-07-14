/**
 * RB-09 — Modifica di un turno passato richiede conferma.
 * Severity: BLOCKING di default (AC RB-09); WARNING se options.strict = false.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * La configurazione viene iniettata tramite il parametro opzionale `options`
 * anziché letta da process.env, garantendo la purezza anche su client.
 * Il chiamante BE (route handler) può passare:
 *   { strict: process.env['PAST_SHIFT_STRICT'] !== 'false' }  // true di default
 * Accetta un parametro `now` per la testabilità.
 */
import type { ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica che il turno non sia già iniziato nel passato.
 *
 * @param input          - Turno da creare o modificare.
 * @param now            - Punto di riferimento temporale (default: Date.now()). Iniettabile per i test.
 * @param options.strict - false → severity WARNING; true (default) → BLOCKING (AC RB-09)
 */
export function validatePastShift(
  input: ShiftInput,
  now: Date = new Date(),
  options?: { strict?: boolean | undefined }
): ValidationResult {
  const result = emptyResult();

  if (input.startDt < now) {
    // Default strict=true: RB-09 è BLOCKING per AC ("modifica turno passato richiede conferma")
    const isStrict = options?.strict ?? true;
    const severity = isStrict ? 'blocking' : 'warning';
    const message = `Il turno inizia nel passato (${input.startDt.toISOString()}). Operazione richiede conferma esplicita.`;

    if (severity === 'blocking') {
      result.valid = false;
      result.blocking.push({
        ruleId: 'RB-09',
        severity: 'blocking',
        message,
        affectedUserId: input.userId,
      });
    } else {
      result.warnings.push({
        ruleId: 'RB-09',
        severity: 'warning',
        message,
        affectedUserId: input.userId,
      });
    }
  }

  return result;
}
