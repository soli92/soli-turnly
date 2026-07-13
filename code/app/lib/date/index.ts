/**
 * lib/date — DST-safe date helpers per Turnly.
 *
 * Wrappa `date-fns` + `@date-fns/tz` per garantire la correttezza
 * nei confronti dell'ora legale (Europe/Rome, DST), come richiesto da:
 * - T-DOM-08: tutti i calcoli data devono essere DST-safe
 * - RB-12: i turni attraverso la mezzanotte devono calcolare la durata
 *           in ore reali, non nominali (importante durante cambio ora legale)
 *
 * Principio: internamente si lavora SEMPRE in UTC, si converte alla
 * timezone locale solo per display o input utente.
 */

import { toZonedTime, fromZonedTime, formatInTimeZone } from "@date-fns/tz";
import {
  format,
  parseISO,
  differenceInMinutes,
  addMinutes,
  startOfDay,
  endOfDay,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { it } from "date-fns/locale";

import type { TimeZoneId } from "@/types";

/** Timezone di default per l'applicazione (T-DOM-08). */
export const APP_TIMEZONE: TimeZoneId = "Europe/Rome";

// =============================================================
// Conversioni UTC ↔ Timezone locale
// =============================================================

/**
 * Converte una data UTC in un oggetto Date "zonato" per la timezone specificata.
 * Utile per operazioni di confronto che devono rispettare l'ora locale.
 *
 * @example
 * const localDate = toZoned(new Date("2024-10-27T01:00:00Z"), "Europe/Rome");
 * // Restituisce la data come se fosse in Europe/Rome (considera DST)
 */
export function toZoned(date: Date, timezone: TimeZoneId = APP_TIMEZONE): Date {
  return toZonedTime(date, timezone);
}

/**
 * Converte una data "zonata" in UTC.
 * Usare quando si riceve input dall'utente (ora locale) e si deve
 * salvare in DB come UTC.
 *
 * @example
 * const utcDate = fromZoned(new Date("2024-03-31T02:30:00"), "Europe/Rome");
 * // Nota: 2024-03-31 02:30 Europe/Rome NON ESISTE (gap DST)
 * // date-fns/tz gestisce questo caso in modo deterministico
 */
export function fromZoned(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): Date {
  return fromZonedTime(date, timezone);
}

// =============================================================
// Durata DST-safe (RB-12)
// =============================================================

/**
 * Calcola la durata reale in minuti tra due timestamp UTC.
 * DST-safe: usa la differenza in millisecondi, non calcolo nominale ore.
 *
 * Caso d'uso critico: turno 22:00–06:00 nel giorno di cambio ora legale
 * ha durata 7h (ora solare → legale) o 9h (ora legale → solare), non 8h nominali.
 *
 * @param startUtc - Timestamp UTC di inizio turno
 * @param endUtc   - Timestamp UTC di fine turno
 * @returns Durata in minuti (interi)
 */
export function getDurationMinutes(startUtc: Date, endUtc: Date): number {
  return differenceInMinutes(endUtc, startUtc);
}

/**
 * Calcola la durata reale in ore (float) tra due timestamp UTC.
 * DST-safe (vedi `getDurationMinutes`).
 */
export function getDurationHours(startUtc: Date, endUtc: Date): number {
  return getDurationMinutes(startUtc, endUtc) / 60;
}

// =============================================================
// Formattazione
// =============================================================

/**
 * Formatta una data UTC nella timezone locale per il display all'utente.
 *
 * @example
 * formatLocal(new Date("2024-10-27T00:00:00Z"), "Europe/Rome", "dd/MM/yyyy HH:mm")
 * // → "27/10/2024 02:00"
 */
export function formatLocal(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE,
  pattern: string = "dd/MM/yyyy HH:mm"
): string {
  return formatInTimeZone(date, timezone, pattern, { locale: it });
}

/**
 * Formatta una data per il display corto (solo data, no ora).
 * @example formatDate(new Date()) → "13/07/2026"
 */
export function formatDate(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): string {
  return formatLocal(date, timezone, "dd/MM/yyyy");
}

/**
 * Formatta solo l'ora di una data UTC nella timezone locale.
 * @example formatTime(new Date()) → "14:30"
 */
export function formatTime(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): string {
  return formatLocal(date, timezone, "HH:mm");
}

/**
 * Formatta una data ISO 8601 string per il display.
 */
export function formatISODate(
  isoString: string,
  timezone: TimeZoneId = APP_TIMEZONE,
  pattern: string = "dd/MM/yyyy HH:mm"
): string {
  return formatLocal(parseISO(isoString), timezone, pattern);
}

// =============================================================
// Utility per range e confronti
// =============================================================

/**
 * Restituisce l'inizio del giorno in UTC per una data nella timezone locale.
 * Utile per query DB: WHERE date >= startOfLocalDay AND date < endOfLocalDay.
 */
export function startOfLocalDay(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): Date {
  const zoned = toZoned(date, timezone);
  return fromZoned(startOfDay(zoned), timezone);
}

/**
 * Restituisce la fine del giorno in UTC per una data nella timezone locale.
 */
export function endOfLocalDay(
  date: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): Date {
  const zoned = toZoned(date, timezone);
  return fromZoned(endOfDay(zoned), timezone);
}

/**
 * Verifica se due timestamp UTC cadono nello stesso giorno locale.
 */
export function isSameLocalDay(
  dateA: Date,
  dateB: Date,
  timezone: TimeZoneId = APP_TIMEZONE
): boolean {
  return isSameDay(toZoned(dateA, timezone), toZoned(dateB, timezone));
}

// =============================================================
// Aggiunta di tempo
// =============================================================

/**
 * Aggiunge minuti a una data.
 * Thin wrapper su date-fns `addMinutes` — DST-safe perché lavora in UTC.
 */
export { addMinutes };

// =============================================================
// Re-export utilità comuni date-fns
// =============================================================

export { parseISO, format, isWithinInterval };
export { it as itLocale };
