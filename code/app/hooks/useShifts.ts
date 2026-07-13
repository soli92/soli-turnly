'use client';

/**
 * hooks/useShifts.ts — TanStack Query hooks per la gestione turni.
 *
 * Consuma:
 *   GET  /api/shifts?week=YYYY-Www       → lista turni settimana
 *   GET  /api/shifts?month=YYYY-MM       → lista turni mese
 *   POST /api/shifts                     → crea turno
 *   PATCH /api/shifts/:id                → modifica turno
 *   DELETE /api/shifts/:id               → elimina turno
 *
 * Nota: gli endpoint /api/shifts sono implementati in TSK-007.
 * I mutation falliscono con 404 finché TSK-007 non è done.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { ShiftRow } from '@/types';
import type { ShiftCreateInput, ShiftPatchInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const shiftKeys = {
  all: ['shifts'] as const,
  byWeek: (week: string) => ['shifts', 'week', week] as const,
  byMonth: (month: string) => ['shifts', 'month', month] as const,
};

// ---------------------------------------------------------------------------
// API response type
// ---------------------------------------------------------------------------

interface ShiftsApiResponse {
  data: ShiftRow[];
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchShiftsByWeek(week: string): Promise<ShiftRow[]> {
  const res = await fetch(`/api/shifts?week=${encodeURIComponent(week)}`);
  if (!res.ok) {
    throw new Error(`Errore API turni: ${res.status} ${res.statusText}`);
  }
  const json: ShiftsApiResponse = await res.json();
  return json.data;
}

async function fetchShiftsByMonth(month: string): Promise<ShiftRow[]> {
  const res = await fetch(`/api/shifts?month=${encodeURIComponent(month)}`);
  if (!res.ok) {
    throw new Error(`Errore API turni: ${res.status} ${res.statusText}`);
  }
  const json: ShiftsApiResponse = await res.json();
  return json.data;
}

// ---------------------------------------------------------------------------
// useShifts — settimana corrente
// ---------------------------------------------------------------------------

/**
 * Fetcha i turni per una settimana ISO (es. "2024-W28").
 *
 * @param week - Formato YYYY-Www (ISO 8601 week)
 * @param options - Opzioni aggiuntive useQuery (es. initialData dal server)
 */
export function useShifts(
  week: string,
  options?: Partial<UseQueryOptions<ShiftRow[]>>,
) {
  return useQuery<ShiftRow[]>({
    queryKey: shiftKeys.byWeek(week),
    queryFn: () => fetchShiftsByWeek(week),
    staleTime: 60 * 1000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useShiftsByMonth — mese
// ---------------------------------------------------------------------------

/**
 * Fetcha i turni per un mese (es. "2024-07").
 *
 * @param month - Formato YYYY-MM
 */
export function useShiftsByMonth(
  month: string,
  options?: Partial<UseQueryOptions<ShiftRow[]>>,
) {
  return useQuery<ShiftRow[]>({
    queryKey: shiftKeys.byMonth(month),
    queryFn: () => fetchShiftsByMonth(month),
    staleTime: 60 * 1000,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// useCreateShift
// ---------------------------------------------------------------------------

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ShiftCreateInput) => {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Errore ${res.status}`,
        );
      }
      return res.json() as Promise<ShiftRow>;
    },
    onSuccess: () => {
      // Invalida tutte le query sui turni per forzare il refetch
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateShift
// ---------------------------------------------------------------------------

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ShiftPatchInput;
    }) => {
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Errore ${res.status}`,
        );
      }
      return res.json() as Promise<ShiftRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteShift
// ---------------------------------------------------------------------------

export function useDeleteShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shifts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Errore ${res.status}`,
        );
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}
