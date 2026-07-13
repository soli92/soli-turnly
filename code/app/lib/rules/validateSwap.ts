/**
 * RB-10 — Swap valido: re-applica RB-01..08 per entrambe le parti.
 *
 * Uno swap scambia gli userId di due turni. Verifica che dopo lo scambio
 * né l'utente A né l'utente B abbiano violazioni sulle regole RB-01..08.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import type { Absence, ExistingShift, ValidationResult } from './types';
import { emptyResult, mergeResults } from './types';
import { validateNoOverlap } from './validateNoOverlap';
import { validateMinRest } from './validateMinRest';
import { validateWeeklyRest } from './validateWeeklyRest';
import { validateConsecutiveDays } from './validateConsecutiveDays';
import { validateWeeklyHours } from './validateWeeklyHours';
import { validateCoverage } from './validateCoverage';
import { validateNoShiftOnAbsence } from './validateNoShiftOnAbsence';
import { validatePastShift } from './validatePastShift';

export interface SwapInput {
  /** Turno dell'utente A (che passerà all'utente B). */
  shiftA: ExistingShift;
  /** Turno dell'utente B (che passerà all'utente A). */
  shiftB: ExistingShift;
  /** Tutti i turni esistenti di entrambi gli utenti. */
  allShifts: ExistingShift[];
  /** Assenze di entrambi gli utenti. */
  absences: Absence[];
  /** Ore contrattuali settimanali per utente A. */
  contractHoursA?: number;
  /** Ore contrattuali settimanali per utente B. */
  contractHoursB?: number;
  /** Punto di riferimento temporale (iniettabile per i test). */
  now?: Date;
}

/**
 * Valida uno swap di turni tra due utenti.
 * Dopo lo swap: shiftA.userId diventa shiftB.userId e viceversa.
 */
export function validateSwap(input: SwapInput): ValidationResult {
  const {
    shiftA,
    shiftB,
    allShifts,
    absences,
    now = new Date(),
  } = input;

  // Costruisce gli "input" risultanti dallo swap
  const inputAtoB = {
    userId: shiftB.userId, // A va a B
    startDt: shiftA.startDt,
    endDt: shiftA.endDt,
    id: shiftA.id,
  };

  const inputBtoA = {
    userId: shiftA.userId, // B va a A
    startDt: shiftB.startDt,
    endDt: shiftB.endDt,
    id: shiftB.id,
  };

  // Existing shifts escludono i due turni scambiati (verranno rimpiazzati)
  const existingExcludingSwap = allShifts.filter(
    (s) => s.id !== shiftA.id && s.id !== shiftB.id,
  );

  // Aggiunge il turno "ospite" agli existing per la validazione incrociata
  const existingForA = [
    ...existingExcludingSwap,
    { ...shiftA, userId: shiftB.userId },
  ];
  const existingForB = [
    ...existingExcludingSwap,
    { ...shiftB, userId: shiftA.userId },
  ];

  let result = emptyResult();

  // Valida posizionamento di shiftA sull'utente B
  result = mergeResults(result, validateNoOverlap(inputAtoB, existingForA));
  result = mergeResults(result, validateMinRest(inputAtoB, existingForA));
  result = mergeResults(result, validateWeeklyRest(inputAtoB, existingForA));
  result = mergeResults(result, validateConsecutiveDays(inputAtoB, existingForA));
  result = mergeResults(result, validateWeeklyHours(inputAtoB, existingForA));
  result = mergeResults(result, validateNoShiftOnAbsence(inputAtoB, absences));
  result = mergeResults(result, validatePastShift(inputAtoB, now));

  // Valida posizionamento di shiftB sull'utente A
  result = mergeResults(result, validateNoOverlap(inputBtoA, existingForB));
  result = mergeResults(result, validateMinRest(inputBtoA, existingForB));
  result = mergeResults(result, validateWeeklyRest(inputBtoA, existingForB));
  result = mergeResults(result, validateConsecutiveDays(inputBtoA, existingForB));
  result = mergeResults(result, validateWeeklyHours(inputBtoA, existingForB));
  result = mergeResults(result, validateNoShiftOnAbsence(inputBtoA, absences));
  result = mergeResults(result, validatePastShift(inputBtoA, now));

  return result;
}
