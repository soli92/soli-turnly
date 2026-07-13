/**
 * RB-12 — Calcolo durata turno DST-safe.
 * Severity: CORRECTNESS (non produce violation, restituisce valore numerico)
 *
 * Usa differenceInMinutes di date-fns che lavora internamente in millisecondi UTC,
 * garantendo il calcolo corretto anche in presenza di cambi ora legale (DST).
 *
 * Esempi DST (Europe/Rome):
 * - DST forward  30 Mar 2025 01:00 CET → 08:00 CEST = 360 min (non 420)
 * - DST backward 26 Oct 2025 01:00 CEST → 09:00 CET = 540 min (non 480)
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { differenceInMinutes } from 'date-fns';

/**
 * Calcola la durata reale di un turno in minuti, DST-safe.
 *
 * @param startDt - Data/ora di inizio (oggetto Date o stringa ISO).
 * @param endDt   - Data/ora di fine (oggetto Date o stringa ISO).
 * @returns Durata in minuti (sempre positiva se endDt > startDt).
 */
export function calculateShiftDurationMinutes(
  startDt: Date,
  endDt: Date,
): number {
  return differenceInMinutes(endDt, startDt);
}

/**
 * Calcola la durata reale di un turno in ore decimali, DST-safe.
 *
 * @param startDt - Data/ora di inizio.
 * @param endDt   - Data/ora di fine.
 * @returns Durata in ore (es. 7.5 per 7h 30min).
 */
export function calculateShiftDurationHours(
  startDt: Date,
  endDt: Date,
): number {
  return differenceInMinutes(endDt, startDt) / 60;
}
