/**
 * lib/rules/types.ts — Tipi condivisi per il motore regole di business.
 *
 * Usabile sia da FE (feedback ottimistico) sia da BE (autorità T-INT-01).
 * Nessuna dipendenza da DB — solo tipi puri.
 */

export type RuleId =
  | 'RB-01'
  | 'RB-02'
  | 'RB-03'
  | 'RB-04'
  | 'RB-05'
  | 'RB-06'
  | 'RB-07'
  | 'RB-08'
  | 'RB-09'
  | 'RB-10'
  | 'RB-11'
  | 'RB-12'
  | 'RB-13'
  | 'RB-14'
  | 'RB-15'
  | 'RB-16'
  | 'RB-17';

export type Severity = 'blocking' | 'warning' | 'info';

export interface RuleViolation {
  ruleId: RuleId;
  severity: Severity;
  message: string;
  field?: string;
  affectedUserId?: string;
}

export interface ValidationResult {
  valid: boolean;
  blocking: RuleViolation[];
  warnings: RuleViolation[];
  info: RuleViolation[];
}

export function emptyResult(): ValidationResult {
  return { valid: true, blocking: [], warnings: [], info: [] };
}

/**
 * Aggiunge una violation al result e aggiorna valid se è blocking.
 */
export function addViolation(result: ValidationResult, v: RuleViolation): void {
  if (v.severity === 'blocking') {
    result.blocking.push(v);
    result.valid = false;
  } else if (v.severity === 'warning') {
    result.warnings.push(v);
  } else {
    result.info.push(v);
  }
}

/**
 * Unisce due ValidationResult in uno.
 */
export function mergeResults(a: ValidationResult, b: ValidationResult): ValidationResult {
  return {
    valid: a.valid && b.valid,
    blocking: [...a.blocking, ...b.blocking],
    warnings: [...a.warnings, ...b.warnings],
    info: [...a.info, ...b.info],
  };
}

// =============================================================
// Input types per le regole
// =============================================================

export interface ShiftInput {
  userId: string;
  startDt: Date;
  endDt: Date;
  /** Presente in caso di modifica: escludi questo ID dal controllo sovrapposizioni. */
  // NOTE: esplicito | undefined per compatibilità con exactOptionalPropertyTypes.
  id?: string | undefined;
}

export interface ExistingShift {
  id: string;
  userId: string;
  startDt: Date;
  endDt: Date;
}

export interface Absence {
  id: string;
  userId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  status: string;
}

export interface CoverageRequirement {
  /** Qualifica richiesta (es. "nurse", "doctor"). */
  qualification: string;
  /** Inizio fascia oraria. */
  slotStart: Date;
  /** Fine fascia oraria. */
  slotEnd: Date;
  /** Numero minimo di operatori con quella qualifica. */
  minCount: number;
}

export interface PlannedShift extends ExistingShift {
  qualification?: string;
}

export interface AvailabilityEntry {
  userId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  unavailableFrom?: string;
  /** HH:mm */
  unavailableTo?: string;
  allDay?: boolean;
}
