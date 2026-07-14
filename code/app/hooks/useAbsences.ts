'use client';

/**
 * hooks/useAbsences.ts — TanStack Query hooks per la gestione assenze admin (TSK-017).
 *
 * Consuma:
 *   GET  /api/admin/absences?userId=X&from=Y&to=Z   → lista assenze con filtri
 *   POST /api/admin/absences/check-conflicts         → dry-run conflitti
 *   POST /api/admin/absences                         → crea assenza (con risoluzioni)
 *   DELETE /api/admin/absences/:id                   → elimina assenza
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { ShiftConflict } from '@/app/api/admin/absences/check-conflicts/route';
import type { AbsenceAdminWithResolutionsInput, CheckConflictsInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi risposta API
// ---------------------------------------------------------------------------

export interface AbsenceRow {
  id: string;
  userId: string;
  absenceTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string; // ISO
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
}

// NOTE: esplicito | undefined per compatibilità con exactOptionalPropertyTypes.
export interface AbsencesFilters {
  userId?: string | undefined;
  from?: string | undefined; // YYYY-MM-DD
  to?: string | undefined; // YYYY-MM-DD
  status?: 'pending' | 'approved' | 'rejected' | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface CheckConflictsResult {
  shifts: ShiftConflict[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const absenceKeys = {
  all: ['absences'] as const,
  list: (filters: AbsencesFilters) => ['absences', 'list', filters] as const,
};

// ---------------------------------------------------------------------------
// useAbsences — GET /api/admin/absences
// ---------------------------------------------------------------------------

/**
 * Fetcha la lista assenze con filtri opzionali.
 *
 * @param filters - userId, from, to, status, page, limit
 * @param options - override UseQueryOptions
 */
export function useAbsences(
  filters: AbsencesFilters = {},
  options?: Partial<UseQueryOptions<AbsenceRow[]>>
) {
  return useQuery<AbsenceRow[]>({
    queryKey: absenceKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const url = `/api/admin/absences${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Errore caricamento assenze: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { data: AbsenceRow[] };
      return json.data;
    },
    staleTime: 60 * 1000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useCheckConflicts — POST /api/admin/absences/check-conflicts
// ---------------------------------------------------------------------------

/**
 * Mutation dry-run: restituisce i turni in conflitto con il range assenza.
 * Non scrive nulla — solo lettura.
 */
export function useCheckConflicts() {
  return useMutation({
    mutationFn: async (data: CheckConflictsInput): Promise<CheckConflictsResult> => {
      const res = await fetch('/api/admin/absences/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<CheckConflictsResult>;
    },
  });
}

// ---------------------------------------------------------------------------
// useCreateAbsence — POST /api/admin/absences
// ---------------------------------------------------------------------------

/**
 * Crea un'assenza, applicando prima le conflict resolutions (annulla/mantieni/riassegna).
 * Invalida le query di assenze e turni dopo il successo.
 */
export function useCreateAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AbsenceAdminWithResolutionsInput): Promise<AbsenceRow> => {
      const res = await fetch('/api/admin/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        const err = new Error(body.error ?? `Errore ${res.status}`) as Error & {
          issues?: Array<{ path: string[]; message: string }>;
        };
        if (body.issues) err.issues = body.issues;
        throw err;
      }
      return res.json() as Promise<AbsenceRow>;
    },
    onSuccess: () => {
      // Invalida assenze e turni (RF-G CA1: RB-08 blocca nuovi turni nelle date)
      queryClient.invalidateQueries({ queryKey: absenceKeys.all });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteAbsence — DELETE /api/admin/absences/:id
// ---------------------------------------------------------------------------

/**
 * Elimina un'assenza (solo se non ancora applicata, gestito dal BE).
 */
export function useDeleteAbsence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/admin/absences/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: absenceKeys.all });
    },
  });
}
