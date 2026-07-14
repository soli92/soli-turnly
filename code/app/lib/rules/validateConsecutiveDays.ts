/**
 * RB-04 — Massimo 6 giorni consecutivi con turno assegnato.
 * Severity: WARNING
 *
 * Conta i giorni consecutivi attorno alla data del nuovo turno (incluso).
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { addDays, startOfDay } from 'date-fns';
import type { ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

const MAX_CONSECUTIVE_DAYS = 6;

/**
 * Restituisce il set di date (ms) coperte da turni per un utente.
 */
function userCoveredDays(shifts: ExistingShift[]): Set<number> {
  const days = new Set<number>();
  for (const s of shifts) {
    let current = startOfDay(s.startDt);
    const end = startOfDay(s.endDt);
    while (current <= end) {
      days.add(current.getTime());
      current = addDays(current, 1);
    }
  }
  return days;
}

/**
 * Verifica che l'utente non superi 6 giorni consecutivi con turno
 * includendo il nuovo turno.
 */
export function validateConsecutiveDays(
  input: ShiftInput,
  existing: ExistingShift[]
): ValidationResult {
  const result = emptyResult();

  const fakeShift: ExistingShift = {
    id: '__new__',
    userId: input.userId,
    startDt: input.startDt,
    endDt: input.endDt,
  };

  const sameUser = [
    ...existing.filter((s) => s.userId === input.userId && s.id !== input.id),
    fakeShift,
  ];

  const days = userCoveredDays(sameUser);

  // A partire dalla data del nuovo turno, espandi in entrambe le direzioni
  const newDay = startOfDay(input.startDt);
  let streak = 1; // conta il giorno stesso

  // Conta verso il passato
  let prev = addDays(newDay, -1);
  while (days.has(prev.getTime())) {
    streak++;
    prev = addDays(prev, -1);
  }

  // Conta verso il futuro
  let next = addDays(newDay, 1);
  while (days.has(next.getTime())) {
    streak++;
    next = addDays(next, 1);
  }

  if (streak > MAX_CONSECUTIVE_DAYS) {
    result.warnings.push({
      ruleId: 'RB-04',
      severity: 'warning',
      message: `Massimo giorni consecutivi superato: ${streak} giorni consecutivi (massimo ${MAX_CONSECUTIVE_DAYS})`,
      affectedUserId: input.userId,
    });
  }

  return result;
}
