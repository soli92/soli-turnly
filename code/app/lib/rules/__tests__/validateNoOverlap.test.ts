/**
 * T-DOM-02 — RB-01: No turni sovrapposti per lo stesso utente.
 */
import { describe, expect, it } from 'vitest';
import { validateNoOverlap } from '../validateNoOverlap';
import type { ExistingShift, ShiftInput } from '../types';

const USER_A = 'user-a';

function makeShift(id: string, userId: string, start: string, end: string): ExistingShift {
  return {
    id,
    userId,
    startDt: new Date(start),
    endDt: new Date(end),
  };
}

function makeInput(userId: string, start: string, end: string, id?: string): ShiftInput {
  return {
    userId,
    startDt: new Date(start),
    endDt: new Date(end),
    id,
  };
}

describe('validateNoOverlap (RB-01)', () => {
  describe('nessuna sovrapposizione', () => {
    it('turni sequenziali — nessuna violation', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z')];
      const input = makeInput(USER_A, '2025-06-10T16:00:00Z', '2025-06-10T20:00:00Z');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(true);
      expect(result.blocking).toHaveLength(0);
    });

    it('turni di utenti diversi — nessuna violation', () => {
      const existing = [makeShift('s1', 'user-b', '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z')];
      const input = makeInput(USER_A, '2025-06-10T10:00:00Z', '2025-06-10T14:00:00Z');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(true);
      expect(result.blocking).toHaveLength(0);
    });
  });

  describe('sovrapposizione esatta', () => {
    it('stesso intervallo — BLOCKING', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z')];
      const input = makeInput(USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]?.ruleId).toBe('RB-01');
      expect(result.blocking[0]?.severity).toBe('blocking');
    });
  });

  describe('sovrapposizione parziale', () => {
    it('nuovo turno inizia a metà del turno esistente — BLOCKING', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z')];
      const input = makeInput(USER_A, '2025-06-10T12:00:00Z', '2025-06-10T20:00:00Z');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(false);
      expect(result.blocking[0]?.ruleId).toBe('RB-01');
    });

    it('turno esistente contiene il nuovo — BLOCKING', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T06:00:00Z', '2025-06-10T22:00:00Z')];
      const input = makeInput(USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(false);
    });
  });

  describe('modifica turno esistente', () => {
    it('modifica con stesso ID — non si sovrappone con se stesso', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z')];
      // Modifica: sposto di un'ora
      const input = makeInput(USER_A, '2025-06-10T09:00:00Z', '2025-06-10T17:00:00Z', 's1');

      const result = validateNoOverlap(input, existing);

      expect(result.valid).toBe(true);
    });
  });
});
