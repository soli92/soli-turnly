'use client';

/**
 * hooks/useSwap.ts — TanStack Query hooks per la gestione scambi turno (TSK-026).
 *
 * Consuma:
 *   GET  /api/admin/swap/preview?shiftAId=<uuid>&shiftBId=<uuid>
 *        → anteprima RB-10 senza modifiche DB
 *   POST /api/admin/swap[?confirm=true]
 *        → esegue lo swap (con o senza conferma esplicita)
 *   GET  /api/shifts?userId=<uuid>
 *        → lista turni di un utente per ShiftSearchPanel
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RuleViolation } from '@/lib/rules/types';
import { shiftKeys } from './useShifts';

// ---------------------------------------------------------------------------
// Tipi risposta
// ---------------------------------------------------------------------------

export interface SwapPreviewResult {
  valid: boolean;
  blocking: RuleViolation[];
  warnings: RuleViolation[];
  info: RuleViolation[];
}

export type SwapOutcome =
  | { outcome: 'rejected'; blocking: RuleViolation[] }
  | { outcome: 'warnings'; requiresConfirmation: true; warnings: RuleViolation[] }
  | { outcome: 'executed'; swapOperationId: string };

export interface ShiftSearchResult {
  id: string;
  userId: string;
  date: string;
  startDt: string;
  endDt: string;
  notes: string | null;
  status: 'planned' | 'confirmed' | 'cancelled';
  shiftTypeId: string | null;
}

export interface ShiftSearchApiResponse {
  data: ShiftSearchResult[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const swapKeys = {
  all: ['swap'] as const,
  preview: (shiftAId: string, shiftBId: string) => ['swap', 'preview', shiftAId, shiftBId] as const,
  userShifts: (userId: string, dateFrom?: string) =>
    ['swap', 'user-shifts', userId, dateFrom] as const,
};

// ---------------------------------------------------------------------------
// useSwapPreview — GET /api/admin/swap/preview
// Si attiva automaticamente quando entrambi i turni sono selezionati.
// ---------------------------------------------------------------------------

export function useSwapPreview(shiftAId: string | null, shiftBId: string | null) {
  return useQuery<SwapPreviewResult>({
    queryKey: swapKeys.preview(shiftAId ?? '', shiftBId ?? ''),
    queryFn: async () => {
      const params = new URLSearchParams({
        shiftAId: shiftAId!,
        shiftBId: shiftBId!,
      });
      const res = await fetch(`/api/admin/swap/preview?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore anteprima: ${res.status}`);
      }
      return res.json() as Promise<SwapPreviewResult>;
    },
    enabled: Boolean(shiftAId) && Boolean(shiftBId) && shiftAId !== shiftBId,
    staleTime: 30 * 1000,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// useUserShifts — GET /api/shifts?userId=<uuid>[&dateFrom=<date>]
// Carica i turni di un utente specifico per il pannello di ricerca.
// ---------------------------------------------------------------------------

export function useUserShifts(userId: string | null, dateFrom?: string) {
  return useQuery<ShiftSearchResult[]>({
    queryKey: swapKeys.userShifts(userId ?? '', dateFrom),
    queryFn: async () => {
      const params = new URLSearchParams({ userId: userId! });
      if (dateFrom) params.set('dateFrom', dateFrom);
      params.set('limit', '100');
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Errore caricamento turni: ${res.status}`);
      }
      const json = (await res.json()) as ShiftSearchApiResponse;
      return (json.data ?? []).filter((s) => s.status !== 'cancelled');
    },
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useExecuteSwap — POST /api/admin/swap[?confirm=true]
// ---------------------------------------------------------------------------

export function useExecuteSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shiftIdA,
      shiftIdB,
      notes,
      confirm,
    }: {
      shiftIdA: string;
      shiftIdB: string;
      notes?: string | null;
      confirm?: boolean;
    }): Promise<SwapOutcome> => {
      const params = new URLSearchParams();
      if (confirm) params.set('confirm', 'true');

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/admin/swap${queryString}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftIdA, shiftIdB, notes: notes ?? null }),
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => ({ outcome: 'rejected', blocking: [] }));
        return body as SwapOutcome;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore swap: ${res.status}`);
      }

      return res.json() as Promise<SwapOutcome>;
    },
    onSuccess: (data) => {
      if (data.outcome === 'executed') {
        // Invalida cache turni (i userId dei turni sono cambiati)
        queryClient.invalidateQueries({ queryKey: shiftKeys.all });
        queryClient.invalidateQueries({ queryKey: swapKeys.all });
      }
    },
  });
}
