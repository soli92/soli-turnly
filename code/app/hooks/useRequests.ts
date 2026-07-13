'use client';

/**
 * hooks/useRequests.ts — TanStack Query hooks per la gestione richieste dipendente.
 *
 * Consuma:
 *   GET  /api/requests                    → lista richieste (con filtri)
 *   POST /api/requests                    → crea richiesta
 *   POST /api/requests/{id}/approve       → approva richiesta (admin)
 *   POST /api/requests/{id}/reject        → rifiuta richiesta (admin)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestCreateInput, ResolveRequestInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi risposta API
// ---------------------------------------------------------------------------

export interface RequestRow {
  id: string;
  type: 'absence' | 'shift_swap' | 'new_shift' | 'modify_shift';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: Record<string, unknown> | null;
  resolvedNotes: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  userFirstName?: string;
  userLastName?: string;
}

export interface RequestFilters {
  status?: string;
  type?: string;
  userId?: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const requestKeys = {
  all: ['requests'] as const,
  list: (filters?: RequestFilters) => ['requests', 'list', filters] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchRequests(filters?: RequestFilters): Promise<RequestRow[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.userId) params.set('userId', filters.userId);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/requests${query}`);
  if (!res.ok) {
    throw new Error(`Errore nel caricamento richieste: ${res.status}`);
  }
  const json = await res.json() as { data: RequestRow[] };
  return json.data;
}

// ---------------------------------------------------------------------------
// useRequests — lista richieste con filtri opzionali
// ---------------------------------------------------------------------------

export function useRequests(filters?: RequestFilters) {
  return useQuery<RequestRow[]>({
    queryKey: requestKeys.list(filters),
    queryFn: () => fetchRequests(filters),
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useCreateRequest — POST /api/requests
// ---------------------------------------------------------------------------

export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RequestCreateInput) => {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        const err = new Error(body.error ?? `Errore ${res.status}`) as Error & {
          issues?: Array<{ path: string[]; message: string }>;
        };
        err.issues = body.issues;
        throw err;
      }
      return res.json() as Promise<RequestRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useApproveRequest — POST /api/requests/{id}/approve
// ---------------------------------------------------------------------------

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ResolveRequestInput;
    }) => {
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<RequestRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useRejectRequest — POST /api/requests/{id}/reject
// ---------------------------------------------------------------------------

export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ResolveRequestInput;
    }) => {
      const res = await fetch(`/api/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<RequestRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}
