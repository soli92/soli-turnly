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

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
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
export function useShifts(week: string, options?: Partial<UseQueryOptions<ShiftRow[]>>) {
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
export function useShiftsByMonth(month: string, options?: Partial<UseQueryOptions<ShiftRow[]>>) {
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
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
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
    mutationFn: async ({ id, data }: { id: string; data: ShiftPatchInput }) => {
      const res = await fetch(`/api/shifts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<ShiftRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useMyFutureShifts — turni futuri del dipendente autenticato
// GET /api/shifts?dateFrom=<oggi>
// ---------------------------------------------------------------------------

/**
 * Restituisce i turni futuri (da oggi in poi) del dipendente autenticato.
 * Usato dal wizard nuova richiesta step 2b (scambio) e 2d (modifica).
 *
 * @param dateFrom - Data inizio filtro YYYY-MM-DD (default: oggi)
 */
export function useMyFutureShifts(dateFrom?: string) {
  const from = dateFrom ?? new Date().toISOString().slice(0, 10);

  return useQuery<ShiftRow[]>({
    queryKey: ['shifts', 'mine-future', from] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: from });
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Errore API turni: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as { data: ShiftRow[] };
      // Filtra turni non cancellati
      return (json.data ?? []).filter((s) => s.status !== 'cancelled');
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useAvailableSwapShifts — turni colleghi disponibili per scambio
// GET /api/shifts?available_for_swap=true
//
// Nota: l'endpoint filtra i turni dei colleghi della stessa fascia/qualifica.
// Il supporto BE completo è in roadmap (T-SEC-01 applica sempre il filtro
// per userId; un futuro endpoint dedicato gestirà il cross-user lookup).
// La risposta viene gestita gracefully se l'endpoint restituisce 404/501.
// ---------------------------------------------------------------------------

export interface AvailableSwapShift extends ShiftRow {
  userName?: string;
}

export function useAvailableSwapShifts() {
  return useQuery<AvailableSwapShift[]>({
    queryKey: ['shifts', 'available-for-swap'] as const,
    queryFn: async () => {
      const res = await fetch('/api/shifts?available_for_swap=true');
      if (!res.ok) {
        // Graceful degradation: endpoint non ancora implementato
        if (res.status === 404 || res.status === 501) return [];
        throw new Error(`Errore API turni scambio: ${res.status}`);
      }
      const json = (await res.json()) as { data?: AvailableSwapShift[] };
      return json.data ?? [];
    },
    staleTime: 30 * 1000,
    retry: false,
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
        throw new Error((body as { error?: string }).error ?? `Errore ${res.status}`);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}
