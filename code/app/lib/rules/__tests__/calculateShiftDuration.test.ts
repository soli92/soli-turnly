/**
 * T-DOM-08 — RB-12: Calcolo durata turno DST-safe.
 *
 * Usa Date UTC direttamente per evitare dipendenze dalla timezone del sistema.
 *
 * Europe/Rome DST 2025:
 * - Forward:  30 Mar 2025 02:00 CET → 03:00 CEST (UTC+1 → UTC+2)
 * - Backward: 26 Oct 2025 03:00 CEST → 02:00 CET (UTC+2 → UTC+1)
 */
import { describe, expect, it } from 'vitest';
import {
  calculateShiftDurationHours,
  calculateShiftDurationMinutes,
} from '../calculateShiftDuration';

describe('calculateShiftDurationMinutes (RB-12)', () => {
  describe('turno normale (nessun DST)', () => {
    it('turno 8 ore = 480 minuti', () => {
      const start = new Date('2025-06-15T08:00:00Z');
      const end = new Date('2025-06-15T16:00:00Z');

      expect(calculateShiftDurationMinutes(start, end)).toBe(480);
    });

    it('turno 7.5 ore = 450 minuti', () => {
      const start = new Date('2025-06-15T08:00:00Z');
      const end = new Date('2025-06-15T15:30:00Z');

      expect(calculateShiftDurationMinutes(start, end)).toBe(450);
    });

    it('turno 12 ore = 720 minuti', () => {
      const start = new Date('2025-06-15T20:00:00Z');
      const end = new Date('2025-06-16T08:00:00Z');

      expect(calculateShiftDurationMinutes(start, end)).toBe(720);
    });
  });

  describe('DST forward (30 Mar 2025 — Europe/Rome)', () => {
    it('01:00 CET → 08:00 CEST = 360 minuti (non 420 naive)', () => {
      // 01:00 CET = 00:00 UTC
      // 08:00 CEST = 06:00 UTC (UTC+2 dopo il cambio ora)
      // L'ora 02:00-03:00 viene saltata → durata fisica 6h = 360 min
      const start = new Date('2025-03-30T00:00:00Z'); // 01:00 CET
      const end = new Date('2025-03-30T06:00:00Z'); // 08:00 CEST

      expect(calculateShiftDurationMinutes(start, end)).toBe(360);
    });
  });

  describe('DST backward (26 Oct 2025 — Europe/Rome)', () => {
    it('01:00 CEST → 09:00 CET = 540 minuti (non 480 naive)', () => {
      // 01:00 CEST (UTC+2) = 25 Oct 23:00 UTC
      // 09:00 CET (UTC+1)  = 26 Oct 08:00 UTC
      // Il cambio ora aggiunge 1h → durata fisica 9h = 540 min
      const start = new Date('2025-10-25T23:00:00Z'); // 01:00 CEST
      const end = new Date('2025-10-26T08:00:00Z'); // 09:00 CET

      expect(calculateShiftDurationMinutes(start, end)).toBe(540);
    });
  });
});

describe('calculateShiftDurationHours (RB-12)', () => {
  it('480 minuti = 8 ore esatte', () => {
    const start = new Date('2025-06-15T08:00:00Z');
    const end = new Date('2025-06-15T16:00:00Z');

    expect(calculateShiftDurationHours(start, end)).toBe(8);
  });

  it('DST forward: 360 minuti = 6 ore', () => {
    const start = new Date('2025-03-30T00:00:00Z');
    const end = new Date('2025-03-30T06:00:00Z');

    expect(calculateShiftDurationHours(start, end)).toBe(6);
  });
});
