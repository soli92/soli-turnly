/**
 * RB-09 — Modifica di un turno passato richiede conferma.
 * Severity: WARNING (configurabile a BLOCKING via env PAST_SHIFT_STRICT=true)
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * Accetta un parametro `now` per la testabilità.
 */
import type { ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

function isStrict(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env['PAST_SHIFT_STRICT'] === 'true'
  );
}

/**
 * Verifica che il turno non sia già iniziato nel passato.
 *
 * @param input - Turno da creare o modificare.
 * @param now   - Punto di riferimento temporale (default: Date.now()). Iniettabile per i test.
 */
export function validatePastShift(
  input: ShiftInput,
  now: Date = new Date(),
): ValidationResult {
  const result = emptyResult();

  if (input.startDt < now) {
    const severity = isStrict() ? 'blocking' : 'warning';
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
