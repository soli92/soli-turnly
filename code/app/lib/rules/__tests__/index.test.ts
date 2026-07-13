import { describe, it, expect } from 'vitest';
import { validateShift } from '../index';

describe('validateShift — composita RB-01..09', () => {
  const userId = 'user-1';
  const baseShift = {
    userId,
    startDt: new Date('2025-06-02T07:00:00Z'),
    endDt: new Date('2025-06-02T15:00:00Z'),
  };

  it('nessuna violazione con turno valido', () => {
    const result = validateShift(baseShift, { existingShifts: [], absences: [] });
    expect(result.valid).toBe(true);
    expect(result.blocking).toHaveLength(0);
  });

  it('RB-08: turno durante assenza approvata → blocking', () => {
    const absence = {
      id: 'abs-1',
      userId,
      startDate: '2025-06-02',
      endDate: '2025-06-02',
      status: 'approved',
    };
    const result = validateShift(baseShift, { existingShifts: [], absences: [absence] });
    expect(result.valid).toBe(false);
    expect(result.blocking.some((v) => v.ruleId === 'RB-08')).toBe(true);
  });

  it('RB-01: sovrapposizione turno esistente stesso utente → blocking', () => {
    const overlapping = {
      id: 'shift-existing',
      userId,
      startDt: new Date('2025-06-02T06:00:00Z'),
      endDt: new Date('2025-06-02T10:00:00Z'),
    };
    const result = validateShift(baseShift, {
      existingShifts: [overlapping],
      absences: [],
    });
    expect(result.valid).toBe(false);
    expect(result.blocking.some((v) => v.ruleId === 'RB-01')).toBe(true);
  });

  it('RB-09: turno nel passato → blocking', () => {
    const pastShift = {
      userId,
      startDt: new Date('2020-01-01T07:00:00Z'),
      endDt: new Date('2020-01-01T15:00:00Z'),
    };
    const result = validateShift(pastShift, {
      existingShifts: [],
      absences: [],
      now: new Date('2025-06-02T12:00:00Z'),
    });
    expect(result.valid).toBe(false);
    expect(result.blocking.some((v) => v.ruleId === 'RB-09')).toBe(true);
  });

  it('assenza non approvata non blocca il turno', () => {
    const pendingAbsence = {
      id: 'abs-2',
      userId,
      startDate: '2025-06-02',
      endDate: '2025-06-02',
      status: 'pending',
    };
    const result = validateShift(baseShift, {
      existingShifts: [],
      absences: [pendingAbsence],
    });
    // una pending absence non deve generare violazione RB-08
    expect(result.blocking.some((v) => v.ruleId === 'RB-08')).toBe(false);
  });

  it('turno di un altro utente non causa sovrapposizione per utente corrente', () => {
    const otherUserShift = {
      id: 'shift-other',
      userId: 'user-2',
      startDt: new Date('2025-06-02T06:00:00Z'),
      endDt: new Date('2025-06-02T10:00:00Z'),
    };
    const result = validateShift(baseShift, {
      existingShifts: [otherUserShift],
      absences: [],
    });
    expect(result.valid).toBe(true);
  });
});
