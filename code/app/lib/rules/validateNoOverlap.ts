/**
 * RB-01 — No turni sovrapposti per lo stesso utente.
 * Severity: BLOCKING
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { areIntervalsOverlapping } from 'date-fns';
import type { ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica che il nuovo turno non si sovrapponga con un turno esistente dello
 * stesso utente.
 *
 * @param input     - Dati del turno da creare/modificare.
 * @param existing  - Lista turni esistenti dell'utente (già filtrata per userId
 *                    oppure passata completa — la funzione filtra internamente).
 */
export function validateNoOverlap(input: ShiftInput, existing: ExistingShift[]): ValidationResult {
  const result = emptyResult();

  const sameUserShifts = existing.filter((s) => s.userId === input.userId && s.id !== input.id);

  const overlapping = sameUserShifts.filter((s) =>
    areIntervalsOverlapping(
      { start: input.startDt, end: input.endDt },
      { start: s.startDt, end: s.endDt },
      { inclusive: false }
    )
  );

  if (overlapping.length > 0) {
    // noUncheckedIndexedAccess: overlapping[0] è safe (verificato da overlapping.length > 0)
    const first = overlapping[0]!;
    result.valid = false;
    result.blocking.push({
      ruleId: 'RB-01',
      severity: 'blocking',
      message: `Sovrapposizione con turno ${first.id} (${first.startDt.toISOString()} – ${first.endDt.toISOString()})`,
      affectedUserId: input.userId,
    });
  }

  return result;
}
