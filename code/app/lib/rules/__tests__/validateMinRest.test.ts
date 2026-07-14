/**
 * T-DOM-03 — RB-02: Riposo minimo 11 ore tra turni consecutivi.
 */
import { describe, expect, it } from 'vitest';
import { validateMinRest } from '../validateMinRest';
import type { ExistingShift, ShiftInput } from '../types';

const USER_A = 'user-a';

function makeShift(id: string, userId: string, start: string, end: string): ExistingShift {
  return { id, userId, startDt: new Date(start), endDt: new Date(end) };
}

function makeInput(start: string, end: string): ShiftInput {
  return { userId: USER_A, startDt: new Date(start), endDt: new Date(end) };
}

describe('validateMinRest (RB-02)', () => {
  describe('riposo sufficiente', () => {
    it('12h di riposo dopo turno precedente — nessuna violation', () => {
      // Turno esistente: termina alle 08:00
      // Nuovo turno: inizia alle 20:00 (12h dopo)
      const existing = [makeShift('s1', USER_A, '2025-06-10T00:00:00Z', '2025-06-10T08:00:00Z')];
      const input = makeInput('2025-06-10T20:00:00Z', '2025-06-11T04:00:00Z');

      const result = validateMinRest(input, existing);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.blocking).toHaveLength(0);
    });

    it('11h esatte di riposo — nessuna violation (limite esatto)', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T00:00:00Z', '2025-06-10T08:00:00Z')];
      // 08:00 + 11h = 19:00
      const input = makeInput('2025-06-10T19:00:00Z', '2025-06-11T03:00:00Z');

      const result = validateMinRest(input, existing);

      expect(result.valid).toBe(true);
    });
  });

  describe('riposo insufficiente (modalità default WARNING)', () => {
    it('10h di riposo dopo turno precedente — WARNING', () => {
      // Turno esistente: termina alle 08:00
      // Nuovo turno: inizia alle 18:00 (10h dopo)
      const existing = [makeShift('s1', USER_A, '2025-06-10T00:00:00Z', '2025-06-10T08:00:00Z')];
      const input = makeInput('2025-06-10T18:00:00Z', '2025-06-11T02:00:00Z');

      const result = validateMinRest(input, existing);

      expect(result.valid).toBe(true); // non è blocking in modalità default
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.ruleId).toBe('RB-02');
      expect(result.warnings[0]?.severity).toBe('warning');
    });

    it('8h di riposo — WARNING', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T00:00:00Z', '2025-06-10T08:00:00Z')];
      const input = makeInput('2025-06-10T16:00:00Z', '2025-06-11T00:00:00Z');

      const result = validateMinRest(input, existing);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.ruleId).toBe('RB-02');
    });

    it('riposo insufficiente prima del turno successivo — WARNING', () => {
      // Nuovo turno: termina alle 08:00
      // Turno successivo: inizia alle 16:00 (8h dopo)
      const existing = [makeShift('s2', USER_A, '2025-06-11T16:00:00Z', '2025-06-12T00:00:00Z')];
      const input = makeInput('2025-06-11T00:00:00Z', '2025-06-11T08:00:00Z');

      const result = validateMinRest(input, existing);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.ruleId).toBe('RB-02');
    });
  });

  describe('modalità STRICT (options.strict = true)', () => {
    // La config viene iniettata come parametro — nessun process.env nelle pure functions.
    // Il chiamante BE passa: { strict: process.env['MIN_REST_STRICT'] === 'true' }

    it('10h di riposo — BLOCKING in modalità strict', () => {
      const existing = [makeShift('s1', USER_A, '2025-06-10T00:00:00Z', '2025-06-10T08:00:00Z')];
      const input = makeInput('2025-06-10T18:00:00Z', '2025-06-11T02:00:00Z');

      const result = validateMinRest(input, existing, { strict: true });

      expect(result.valid).toBe(false);
      expect(result.blocking).toHaveLength(1);
      expect(result.blocking[0]?.ruleId).toBe('RB-02');
    });
  });
});
