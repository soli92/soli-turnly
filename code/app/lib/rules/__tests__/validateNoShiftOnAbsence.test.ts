/**
 * T-DOM-04 — RB-08: No turno durante assenza approvata.
 */
import { describe, expect, it } from 'vitest';
import { validateNoShiftOnAbsence } from '../validateNoShiftOnAbsence';
import type { Absence, ShiftInput } from '../types';

const USER_A = 'user-a';

function makeInput(start: string, end: string): ShiftInput {
  return { userId: USER_A, startDt: new Date(start), endDt: new Date(end) };
}

function makeAbsence(id: string, startDate: string, endDate: string, status: string): Absence {
  return { id, userId: USER_A, startDate, endDate, status };
}

describe('validateNoShiftOnAbsence (RB-08)', () => {
  describe('assenza approvata', () => {
    it('turno durante assenza approvata — BLOCKING', () => {
      const absences = [makeAbsence('abs1', '2025-06-10', '2025-06-14', 'approved')];
      // Turno nel mezzo dell'assenza
      const input = makeInput('2025-06-12T08:00:00Z', '2025-06-12T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]?.ruleId).toBe('RB-08');
      expect(result.blocking[0]?.severity).toBe('blocking');
    });

    it('turno nel primo giorno di assenza — BLOCKING', () => {
      const absences = [makeAbsence('abs1', '2025-06-10', '2025-06-14', 'approved')];
      const input = makeInput('2025-06-10T08:00:00Z', '2025-06-10T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(false);
      expect(result.blocking[0]?.ruleId).toBe('RB-08');
    });

    it("turno nell'ultimo giorno di assenza — BLOCKING", () => {
      const absences = [makeAbsence('abs1', '2025-06-10', '2025-06-14', 'approved')];
      const input = makeInput('2025-06-14T08:00:00Z', '2025-06-14T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(false);
    });
  });

  describe('assenza in stato pending', () => {
    it('turno durante assenza pending — nessuna violation', () => {
      const absences = [makeAbsence('abs1', '2025-06-10', '2025-06-14', 'pending')];
      const input = makeInput('2025-06-12T08:00:00Z', '2025-06-12T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(true);
      expect(result.blocking).toHaveLength(0);
    });
  });

  describe('assenza rifiutata', () => {
    it('turno durante assenza rejected — nessuna violation', () => {
      const absences = [makeAbsence('abs1', '2025-06-10', '2025-06-14', 'rejected')];
      const input = makeInput('2025-06-12T08:00:00Z', '2025-06-12T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(true);
    });
  });

  describe('nessuna assenza', () => {
    it('lista assenze vuota — nessuna violation', () => {
      const input = makeInput('2025-06-12T08:00:00Z', '2025-06-12T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, []);

      expect(result.valid).toBe(true);
      expect(result.blocking).toHaveLength(0);
    });
  });

  describe('utenti diversi', () => {
    it('turno di utente B durante assenza approvata di utente A — nessun blocco', () => {
      const absences: Absence[] = [
        {
          id: 'abs1',
          userId: 'user-b',
          startDate: '2025-06-10',
          endDate: '2025-06-14',
          status: 'approved',
        },
      ];
      // Input per USER_A
      const input = makeInput('2025-06-12T08:00:00Z', '2025-06-12T16:00:00Z');

      const result = validateNoShiftOnAbsence(input, absences);

      expect(result.valid).toBe(true);
    });
  });
});
