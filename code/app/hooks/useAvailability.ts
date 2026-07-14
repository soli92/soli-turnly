'use client';

/**
 * hooks/useAvailability.ts — TanStack Query hooks per disponibilità dipendente (TSK-025).
 *
 * Consuma:
 *   GET    /api/users/me/availability       — lista disponibilità utente corrente
 *   POST   /api/users/me/availability       — crea voce di disponibilità
 *   DELETE /api/users/me/availability?id=   — elimina voce (con verifica ownership BE)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AvailabilityCreateInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi risposta API
// ---------------------------------------------------------------------------

export type AvailabilityType = 'available' | 'unavailable' | 'preference';
export type AvailabilityScope = 'recurring' | 'date_range';

export interface RecurringDefinition {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface DateRangeDefinition {
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
}

export type AvailabilityDefinition = RecurringDefinition | DateRangeDefinition;

export interface AvailabilityRow {
  id: string;
  userId: string;
  type: AvailabilityType;
  scope: AvailabilityScope;
  definition: AvailabilityDefinition;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const availabilityKeys = {
  all: ['availability'] as const,
  list: () => ['availability', 'list'] as const,
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchAvailability(): Promise<AvailabilityRow[]> {
  const res = await fetch('/api/users/me/availability');
  if (!res.ok) {
    throw new Error(`Errore nel caricamento disponibilità: ${res.status}`);
  }
  return res.json() as Promise<AvailabilityRow[]>;
}

// ---------------------------------------------------------------------------
// useAvailability — lista disponibilità utente corrente
// ---------------------------------------------------------------------------

export function useAvailability() {
  return useQuery<AvailabilityRow[]>({
    queryKey: availabilityKeys.list(),
    queryFn: fetchAvailability,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useCreateAvailability — POST /api/users/me/availability
// ---------------------------------------------------------------------------

export function useCreateAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AvailabilityCreateInput) => {
      const res = await fetch('/api/users/me/availability', {
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

      return res.json() as Promise<AvailabilityRow>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: availabilityKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteAvailability — DELETE /api/users/me/availability?id=<uuid>
// ---------------------------------------------------------------------------

export function useDeleteAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/me/availability?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (res.status === 403) {
        throw new Error('Non sei autorizzato a eliminare questa voce di disponibilità');
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }

      return res.json() as Promise<{ deleted: boolean }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: availabilityKeys.all });
    },
  });
}
