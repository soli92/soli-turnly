/**
 * types/index.ts — Tipi TypeScript condivisi Turnly.
 *
 * Questi tipi sono la fonte di verità per il domain model.
 * Derivati dallo schema Drizzle (TSK-002) e dai requisiti funzionali (ADR-001).
 */

// =============================================================
// Ruoli utente (RBAC)
// =============================================================

/** Ruoli supportati dall'applicazione (RF-A, RF-A CA2). */
export type UserRole = "admin" | "employee";

// =============================================================
// Tipi contratto
// =============================================================

/** Tipologia di contratto del dipendente (RB-13). */
export type ContractType = "full-time" | "part-time" | "consulente";

// =============================================================
// Stato richiesta (RF-M)
// =============================================================

/**
 * Ciclo di vita di una richiesta dipendente.
 * RB-16: le transizioni di stato sono vincolate dal backend.
 */
export type RequestStatus =
  | "pending"     // In attesa di approvazione admin
  | "approved"    // Approvata dall'admin
  | "rejected"    // Rifiutata dall'admin
  | "cancelled";  // Annullata dal dipendente

/** Tipologia di richiesta (RF-M). */
export type RequestType =
  | "shift-swap"     // Scambio turno con un collega
  | "absence"        // Richiesta assenza/ferie
  | "availability"   // Modifica disponibilità
  | "overtime";      // Richiesta straordinario

// =============================================================
// Stato turno
// =============================================================

/** Stato di un singolo turno. */
export type ShiftStatus =
  | "scheduled"   // Pianificato
  | "confirmed"   // Confermato dall'admin
  | "cancelled"   // Annullato
  | "completed";  // Completato (storico)

/** Origine di un turno (manuale vs ricorrente vs richiesta). */
export type ShiftOrigin =
  | "manual"       // Inserito manualmente dall'admin
  | "recurrence"   // Generato da regola di ricorrenza (RF-E)
  | "request";     // Generato da approvazione richiesta (RF-M)

// =============================================================
// Stato assenza
// =============================================================

/** Stato approvazione di un'assenza. */
export type AbsenceStatus = "pending" | "approved" | "rejected";

/** Tipologia di assenza. */
export type AbsenceType =
  | "ferie"
  | "malattia"
  | "permesso"
  | "maternita-paternita"
  | "altro";

// =============================================================
// Notifiche (SSE, TSK-009)
// =============================================================

/** Tipologia di notifica real-time. */
export type NotificationType =
  | "shift-created"
  | "shift-modified"
  | "shift-cancelled"
  | "request-submitted"
  | "request-approved"
  | "request-rejected"
  | "swap-proposed"
  | "swap-accepted"
  | "swap-rejected";

// =============================================================
// Utility types
// =============================================================

/** Identificatore univoco (UUID v4). */
export type EntityId = string;

/**
 * Timestamp ISO 8601 come stringa.
 * Il parsing DST-safe è responsabilità di `lib/date` (T-DOM-08).
 */
export type ISODateString = string;

/** Timezone identifier (IANA). Default: "Europe/Rome" (T-DOM-08, RB-12). */
export type TimeZoneId = string;

export const DEFAULT_TIMEZONE: TimeZoneId = "Europe/Rome";

// =============================================================
// Business Rules Engine (TSK-006)
// =============================================================

/**
 * Re-export dei tipi del motore regole di business.
 * La fonte di verità è @/lib/rules/types.ts (TSK-006).
 */
export type { RuleId, RuleViolation, Severity, ValidationResult } from '@/lib/rules/types';

// =============================================================
// Matrix FE types (serializzabili Server→Client)
// =============================================================

/**
 * Dipendente come riga della griglia admin (dati ridotti, serializzabili).
 * Usato da ShiftGrid / ShiftCell.
 */
export type EmployeeRow = {
  id: string;
  firstName: string;
  lastName: string;
  qualificationId: string | null;
  qualificationName: string | null;
  qualificationColor: string | null;
  contractHours: number;
  active: boolean;
};

/**
 * Turno come cella della griglia (dati ridotti, serializzabili).
 * startDt e endDt sono ISO strings (Date → toISOString() sul server).
 */
export type ShiftRow = {
  id: string;
  userId: string;
  shiftTypeId: string | null;
  date: string;            // YYYY-MM-DD
  startDt: string;         // ISO 8601 string
  endDt: string;           // ISO 8601 string
  notes: string | null;
  status: "planned" | "confirmed" | "cancelled";
  shiftTypeName: string | null;
  shiftTypeCode: string | null;
  shiftTypeColor: string | null;
};

/**
 * Tipo di turno come riga per il dropdown ShiftEditor.
 */
export type ShiftTypeRow = {
  id: string;
  name: string;
  code: string;
  color: string;
  defaultStartTime: string;  // HH:MM
  defaultEndTime: string;    // HH:MM
  active: boolean;
};

/**
 * Assenza come blocco nella griglia (rende la cella non cliccabile).
 */
export type AbsenceRow = {
  id: string;
  userId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  absenceTypeName: string;
};
