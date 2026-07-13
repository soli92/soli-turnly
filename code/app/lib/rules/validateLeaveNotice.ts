/**
 * RB-17 — Preavviso minimo assenza.
 * Severity: WARNING
 *
 * La richiesta di assenza deve essere inviata almeno N ore prima dell'inizio
 * dell'assenza stessa. Default 24h, configurabile via env LEAVE_NOTICE_HOURS.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * Accetta `now` come parametro per la testabilità.
 */
import { differenceInHours, parseISO } from 'date-fns';
import type { ValidationResult } from './types';
import { emptyResult } from './types';

function getNoticeHours(): number {
  if (typeof process !== 'undefined' && process.env['LEAVE_NOTICE_HOURS']) {
    const parsed = parseInt(process.env['LEAVE_NOTICE_HOURS'], 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 24;
}

/**
 * Verifica il preavviso minimo per una richiesta di assenza.
 *
 * @param absenceStartDate - Data di inizio assenza (YYYY-MM-DD).
 * @param submittedAt      - Momento della submission (default: ora corrente).
 */
export function validateLeaveNotice(
  absenceStartDate: string,
  submittedAt: Date = new Date(),
): ValidationResult {
  const result = emptyResult();
  const noticeHours = getNoticeHours();

  const absenceStart = parseISO(absenceStartDate);
  const hoursBeforeStart = differenceInHours(absenceStart, submittedAt);

  if (hoursBeforeStart < noticeHours) {
    result.warnings.push({
      ruleId: 'RB-17',
      severity: 'warning',
      message: `Preavviso insufficiente: ${hoursBeforeStart}h prima dell'inizio dell'assenza (minimo ${noticeHours}h)`,
    });
  }

  return result;
}
