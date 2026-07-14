/**
 * RB-07 — Sotto-copertura per qualifica/fascia oraria.
 * Severity: WARNING
 *
 * Verifica che eliminando o spostando un turno non si scenda sotto il
 * minimo di copertura richiesto per una qualifica in una determinata fascia.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { areIntervalsOverlapping } from 'date-fns';
import type { CoverageRequirement, PlannedShift, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica la copertura minima dopo la rimozione di un turno (o la modifica
 * che riduce la presenza di una qualifica in una fascia oraria).
 *
 * @param removedShift    - Il turno che verrà rimosso/sostituito.
 * @param plannedShifts   - Tutti i turni pianificati (incluso quello rimosso).
 * @param requirements    - Requisiti di copertura minima per qualifica/fascia.
 */
export function validateCoverage(
  removedShift: PlannedShift,
  plannedShifts: PlannedShift[],
  requirements: CoverageRequirement[]
): ValidationResult {
  const result = emptyResult();

  // Turni rimanenti senza quello rimosso
  const remaining = plannedShifts.filter((s) => s.id !== removedShift.id);

  for (const req of requirements) {
    // Conta quanti turni con la qualifica richiesta coprono la fascia oraria
    const covering = remaining.filter(
      (s) =>
        s.qualification === req.qualification &&
        areIntervalsOverlapping(
          { start: s.startDt, end: s.endDt },
          { start: req.slotStart, end: req.slotEnd },
          { inclusive: false }
        )
    );

    if (covering.length < req.minCount) {
      result.warnings.push({
        ruleId: 'RB-07',
        severity: 'warning',
        message: `Sotto-copertura per qualifica "${req.qualification}" nella fascia ${req.slotStart.toISOString()}–${req.slotEnd.toISOString()}: ${covering.length}/${req.minCount} operatori`,
      });
    }
  }

  return result;
}
