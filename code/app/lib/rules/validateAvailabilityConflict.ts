/**
 * RB-15 — Avviso indisponibilità dichiarata.
 * Severity: WARNING
 *
 * Se il turno cade in un periodo in cui l'utente ha dichiarato
 * indisponibilità, emette un avviso (non un blocco).
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns';
import type { AvailabilityEntry, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica conflitti con l'indisponibilità dichiarata dall'utente.
 *
 * @param input        - Turno da creare o modificare.
 * @param availability - Voci di disponibilità/indisponibilità dell'utente.
 */
export function validateAvailabilityConflict(
  input: ShiftInput,
  availability: AvailabilityEntry[],
): ValidationResult {
  const result = emptyResult();

  const shiftDay = format(startOfDay(input.startDt), 'yyyy-MM-dd');

  const userEntries = availability.filter(
    (a) => a.userId === input.userId && a.date === shiftDay,
  );

  for (const entry of userEntries) {
    if (entry.allDay) {
      result.warnings.push({
        ruleId: 'RB-15',
        severity: 'warning',
        message: `L'utente ha dichiarato indisponibilità per tutto il giorno ${entry.date}`,
        affectedUserId: input.userId,
      });
      break;
    }

    // Controlla sovrapposizione fascia oraria se allDay non è impostato
    if (entry.unavailableFrom && entry.unavailableTo) {
      const unavailStart = parseISO(`${entry.date}T${entry.unavailableFrom}:00`);
      const unavailEnd = parseISO(`${entry.date}T${entry.unavailableTo}:00`);

      const shiftOverlaps =
        input.startDt < unavailEnd && input.endDt > unavailStart;

      if (shiftOverlaps) {
        result.warnings.push({
          ruleId: 'RB-15',
          severity: 'warning',
          message: `Il turno si sovrappone con l'indisponibilità dichiarata (${entry.unavailableFrom}–${entry.unavailableTo} del ${entry.date})`,
          affectedUserId: input.userId,
        });
        break;
      }
    }
  }

  return result;
}
