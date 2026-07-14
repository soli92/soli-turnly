/**
 * RB-03 — Almeno 24h di riposo ogni 7 giorni (finestra rolling).
 * Severity: WARNING
 *
 * Verifica che aggiungendo il nuovo turno non si ottengano 7 giorni
 * consecutivi completamente coperti da turni (nessun giorno libero).
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import { addDays, startOfDay } from 'date-fns';
import type { ExistingShift, ShiftInput, ValidationResult } from './types';
import { emptyResult } from './types';

/**
 * Restituisce il set di date (normalizzate a inizio giornata ms) coperte
 * da turni nella lista fornita.
 */
function coveredDays(shifts: ExistingShift[]): Set<number> {
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
 * Verifica che non esistano 7 giorni consecutivi tutti occupati da turni,
 * includendo il nuovo turno nel computo.
 */
export function validateWeeklyRest(input: ShiftInput, existing: ExistingShift[]): ValidationResult {
  const result = emptyResult();

  // Costruisce shift fittizio dall'input per unificarlo alla lista
  const fakeShift: ExistingShift = {
    id: '__new__',
    userId: input.userId,
    startDt: input.startDt,
    endDt: input.endDt,
  };

  const sameUserShifts = [
    ...existing.filter((s) => s.userId === input.userId && s.id !== input.id),
    fakeShift,
  ];

  const days = coveredDays(sameUserShifts);

  // Controlla una finestra di 7 giorni attorno al nuovo turno (±7 giorni)
  const newDay = startOfDay(input.startDt);
  for (let offset = -6; offset <= 0; offset++) {
    let allCovered = true;
    for (let d = 0; d < 7; d++) {
      const day = addDays(newDay, offset + d);
      if (!days.has(day.getTime())) {
        allCovered = false;
        break;
      }
    }
    if (allCovered) {
      result.warnings.push({
        ruleId: 'RB-03',
        severity: 'warning',
        message:
          'Riposo settimanale insufficiente: 7 giorni consecutivi tutti coperti da turni senza almeno 24h di riposo',
        affectedUserId: input.userId,
      });
      break;
    }
  }

  return result;
}
