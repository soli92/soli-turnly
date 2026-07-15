'use client';

/**
 * hooks/useRecurrences.ts — TanStack Query hooks per la gestione ricorrenze.
 *
 * Consuma:
 *   GET    /api/admin/recurrences             → lista ricorrenze (RF-E)
 *   DELETE /api/admin/recurrences/:id         → disattivazione (soft delete)
 *   POST   /api/admin/recurrence/preview      → dry-run: turni candidati + conflitti
 *   POST   /api/admin/recurrence/generate     → genera turni via Inngest job
 *
 * Nota: gli endpoint preview e generate non sono ancora implementati lato BE.
 * Vedere wiki/gaps.md — GAP-RECURRENCE-API-001.
 *
 * TSK-019, RF-E, RB-11
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Tipi dominio
// ---------------------------------------------------------------------------

/** Riga ricorrenza come restituita da GET /api/admin/recurrences. */
export interface RecurrenceRow {
  id: string;
  userId: string;
  shiftTypeId: string;
  startDate: string;
  endDate: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  daysOfWeek: number[];
  active: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Payload inviato a preview e generate.
 * Copre sia il caso settimanale sia il caso ciclo rotativo.
 */
export interface RecurrenceWizardPayload {
  /** Tipo di ricorrenza. */
  type: 'weekly' | 'rotating';
  /** Configurazione settimanale: giorni con relativo tipo turno. */
  weeklyDays?: Array<{
    dayOfWeek: number; // 0 = domenica, 1 = lunedì, …, 6 = sabato
    shiftTypeId: string;
  }>;
  /** Sequenza ciclo rotativo (array ordinato di shiftTypeId). */
  rotatingSequence?: string[];
  /** Lunghezza ciclo rotativo (default: rotatingSequence.length). */
  cycleLength?: number;
  /** Dipendenti target. */
  userIds: string[];
  /** Inizio intervallo date (YYYY-MM-DD). */
  startDate: string;
  /** Fine intervallo date (YYYY-MM-DD). */
  endDate: string;
  /** Se true, salta le festività configurate nel sistema. */
  skipHolidays: boolean;
}

/** Singolo turno nella risposta preview. */
export interface ShiftPreview {
  userId: string;
  date: string;
  shiftTypeId: string;
  shiftTypeName: string;
  shiftTypeColor: string;
  /** Se true, la riga non verrà generata per via di un conflitto. */
  skipped: boolean;
  skipReason?: 'absence' | 'holiday' | 'overlap';
}

/** Conflitto rilevato nella preview (RB-11). */
export interface RecurrenceConflict {
  userId: string;
  date: string;
  reason: 'absence' | 'holiday' | 'overlap';
}

/** Risposta da POST /api/admin/recurrence/preview. */
export interface PreviewResponse {
  turni: ShiftPreview[];
  conflicts: RecurrenceConflict[];
}

/** Risposta da POST /api/admin/recurrence/generate. */
export interface GenerateResponse {
  generated: number;
  skipped: number;
  jobId?: string;
  /** Stato asincrono del job Inngest. */
  status: 'pending' | 'running' | 'done';
}

// ---------------------------------------------------------------------------
// Tipi errore
// ---------------------------------------------------------------------------

interface ApiErrorBody {
  error?: string;
  issues?: Array<{ path: string[]; message: string }>;
}

export class RecurrenceApiError extends Error {
  issues?: Array<{ path: string[]; message: string }>;

  constructor(message: string, issues?: Array<{ path: string[]; message: string }>) {
    super(message);
    this.name = 'RecurrenceApiError';
    if (issues !== undefined) {
      this.issues = issues;
    }
  }
}

function toApiError(body: ApiErrorBody, status: number): RecurrenceApiError {
  return new RecurrenceApiError(body.error ?? `Errore ${status}`, body.issues);
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const recurrenceKeys = {
  all: ['recurrences'] as const,
  list: () => ['recurrences', 'list'] as const,
  detail: (id: string) => ['recurrences', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// useRecurrences — GET /api/admin/recurrences
// ---------------------------------------------------------------------------

export function useRecurrences() {
  return useQuery<RecurrenceRow[]>({
    queryKey: recurrenceKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/recurrences');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      const json = (await res.json()) as { data: RecurrenceRow[] };
      return json.data ?? [];
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// usePatchRecurrence — PATCH /api/admin/recurrences/:id
// ---------------------------------------------------------------------------

interface PatchRecurrenceArgs {
  id: string;
  patch: {
    shiftTypeId?: string;
    startDate?: string;
    endDate?: string | null;
    frequency?: RecurrenceRow['frequency'];
    daysOfWeek?: number[];
  };
}

export function usePatchRecurrence() {
  const queryClient = useQueryClient();

  return useMutation<RecurrenceRow, RecurrenceApiError, PatchRecurrenceArgs>({
    mutationFn: async ({ id, patch }) => {
      const res = await fetch(`/api/admin/recurrences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<RecurrenceRow>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurrenceKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeactivateRecurrence — DELETE /api/admin/recurrences/:id (soft delete)
// ---------------------------------------------------------------------------

export function useDeactivateRecurrence() {
  const queryClient = useQueryClient();

  return useMutation<string, RecurrenceApiError, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/recurrences/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recurrenceKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// usePreviewRecurrence — POST /api/admin/recurrence/preview (dry-run)
// Nota: endpoint non ancora implementato. Vedere GAP-RECURRENCE-API-001.
// ---------------------------------------------------------------------------

export function usePreviewRecurrence() {
  return useMutation<PreviewResponse, RecurrenceApiError, RecurrenceWizardPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/recurrence/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<PreviewResponse>;
    },
  });
}

// ---------------------------------------------------------------------------
// useGenerateRecurrence — POST /api/admin/recurrence/generate
// Emette evento Inngest 'shift.recurrence.trigger' per più utenti.
// Nota: endpoint non ancora implementato. Vedere GAP-RECURRENCE-API-001.
// ---------------------------------------------------------------------------

export function useGenerateRecurrence() {
  const queryClient = useQueryClient();

  return useMutation<GenerateResponse, RecurrenceApiError, RecurrenceWizardPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/admin/recurrence/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<GenerateResponse>;
    },
    onSuccess: () => {
      // Invalida lista ricorrenze e turni generati
      void queryClient.invalidateQueries({ queryKey: recurrenceKeys.all });
    },
  });
}
