/**
 * RB-17 — Preavviso minimo assenza.
 * Severity: WARNING
 *
 * La richiesta di assenza deve essere inviata almeno N ore prima dell'inizio
 * dell'assenza stessa. Default 24h, configurabile tramite options.noticeHours.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * La configurazione viene iniettata tramite il parametro opzionale `options`
 * anziché letta da process.env, garantendo la purezza anche su client.
 * Il chiamante BE (route handler) può passare:
 *   { noticeHours: parseInt(process.env['LEAVE_NOTICE_HOURS'] ?? '24', 10) }
 * Accetta `now` come parametro per la testabilità.
 */
import { differenceInHours, parseISO } from 'date-fns';
import type { ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Verifica il preavviso minimo per una richiesta di assenza.
 *
 * @param absenceStartDate    - Data di inizio assenza (YYYY-MM-DD).
 * @param submittedAt         - Momento della submission (default: ora corrente).
 * @param options.noticeHours - Ore minime di preavviso (default 24).
 */
export function validateLeaveNotice(
  absenceStartDate: string,
  submittedAt: Date = new Date(),
  options?: { noticeHours?: number }
): ValidationResult {
  const result = emptyResult();
  const noticeHours = options?.noticeHours ?? 24;

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
