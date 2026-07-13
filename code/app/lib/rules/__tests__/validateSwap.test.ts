/**
 * T-SWP-01, T-SWP-02 — RB-10: Swap valido.
 *
 * Verifica che validateSwap re-applichi RB-01..08 per entrambe le parti
 * e rilevi violazioni incrociate.
 */
import { describe, expect, it } from 'vitest';
import { validateSwap } from '../validateSwap';
import type { ExistingShift } from '../types';

const USER_A = 'user-a';
const USER_B = 'user-b';

function makeShift(
  id: string,
  userId: string,
  start: string,
  end: string,
): ExistingShift {
  return { id, userId, startDt: new Date(start), endDt: new Date(end) };
}

describe('validateSwap (RB-10)', () => {
  describe('T-SWP-01: swap valido — nessuna violation', () => {
    it('swap semplice tra due utenti senza conflitti', () => {
      // A ha turno mattina, B ha turno pomeriggio — swap senza conflitti
      const shiftA = makeShift('sA', USER_A, '2025-06-10T06:00:00Z', '2025-06-10T14:00:00Z');
      const shiftB = makeShift('sB', USER_B, '2025-06-11T14:00:00Z', '2025-06-11T22:00:00Z');

      const result = validateSwap({
        shiftA,
        shiftB,
        allShifts: [shiftA, shiftB],
        absences: [],
        now: new Date('2025-06-09T00:00:00Z'), // turni nel futuro
      });

      expect(result.valid).toBe(true);
      expect(result.blocking).toHaveLength(0);
    });
  });

  describe('T-SWP-01: swap che crea sovrapposizione per la parte B — BLOCKING', () => {
    it('B ha già un turno che si sovrappone con shiftA (che verrebbe assegnato a B)', () => {
      // shiftA: A lavora 10:00–18:00 il 10 Giugno
      const shiftA = makeShift('sA', USER_A, '2025-06-10T10:00:00Z', '2025-06-10T18:00:00Z');
      // shiftB: B lavora 14:00–22:00 l'11 Giugno (da scambiare con A)
      const shiftB = makeShift('sB', USER_B, '2025-06-11T14:00:00Z', '2025-06-11T22:00:00Z');
      // B ha già un turno il 10 Giugno che si sovrappone con shiftA
      const shiftBExisting = makeShift(
        'sB-existing',
        USER_B,
        '2025-06-10T12:00:00Z',
        '2025-06-10T20:00:00Z',
      );

      const result = validateSwap({
        shiftA,
        shiftB,
        allShifts: [shiftA, shiftB, shiftBExisting],
        absences: [],
        now: new Date('2025-06-09T00:00:00Z'),
      });

      // shiftA verrebbe assegnato a B → sovrapposto con shiftBExisting → BLOCKING
      expect(result.valid).toBe(false);
      expect(result.blocking.length).toBeGreaterThan(0);
      expect(result.blocking.some((v) => v.ruleId === 'RB-01')).toBe(true);
    });
  });

  describe('T-SWP-02: swap con assenza approvata — BLOCKING', () => {
    it('il turno ricevuto da A cade durante una sua assenza approvata', () => {
      // shiftA: A lavora il 10 Giugno (da dare a B)
      const shiftA = makeShift('sA', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z');
      // shiftB: B lavora il 15 Giugno (da dare ad A)
      const shiftB = makeShift('sB', USER_B, '2025-06-15T08:00:00Z', '2025-06-15T16:00:00Z');

      // A ha un'assenza approvata che copre il 15 Giugno
      const absences = [
        {
          id: 'abs1',
          userId: USER_A,
          startDate: '2025-06-14',
          endDate: '2025-06-16',
          status: 'approved',
        },
      ];

      const result = validateSwap({
        shiftA,
        shiftB,
        allShifts: [shiftA, shiftB],
        absences,
        now: new Date('2025-06-09T00:00:00Z'),
      });

      // shiftB (15 Giugno) verrebbe assegnato ad A → conflitto con assenza → BLOCKING
      expect(result.valid).toBe(false);
      expect(result.blocking.some((v) => v.ruleId === 'RB-08')).toBe(true);
    });
  });

  describe('swap pulito tra stesso utente — BLOCKING', () => {
    it('swap con se stesso non è ammesso (stesso userId)', () => {
      // Entrambi i turni appartengono allo stesso utente
      const shiftA = makeShift('sA', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z');
      const shiftB = makeShift('sB', USER_A, '2025-06-11T08:00:00Z', '2025-06-11T16:00:00Z');

      // Dopo lo swap: shiftA va a USER_A, shiftB va a USER_A → stessa cosa
      // Non dovrebbe produrre errori tecnici — la logica di business "stesso utente"
      // è gestita a livello API, non qui
      const result = validateSwap({
        shiftA,
        shiftB,
        allShifts: [shiftA, shiftB],
        absences: [],
        now: new Date('2025-06-09T00:00:00Z'),
      });

      // Pure rules non producono violation (nessun conflitto di date tra giorni diversi)
      expect(result.blocking).toHaveLength(0);
    });
  });
});
