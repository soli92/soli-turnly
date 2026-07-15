'use client';

/**
 * hooks/useRequests.ts — TanStack Query hooks per la gestione richieste.
 *
 * Consuma:
 *   GET  /api/requests                    → lista richieste (con filtri)
 *   GET  /api/requests/{id}               → dettaglio singola richiesta
 *   GET  /api/requests/{id}/impact        → anteprima impatto pre-approvazione
 *   POST /api/requests                    → crea richiesta
 *   POST /api/requests/{id}/approve       → approva richiesta (admin, RB-14)
 *   POST /api/requests/{id}/reject        → rifiuta richiesta (admin)
 *
 * Tipi status allineati all'enum DB (requestStatusEnum in db/schema.ts):
 *   draft | sent | awaiting_colleague | approved | rejected | cancelled | applied
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestCreateInput, ResolveRequestInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi risposta API
// ---------------------------------------------------------------------------

export type RequestStatus =
  'draft' | 'sent' | 'awaiting_colleague' | 'approved' | 'rejected' | 'cancelled' | 'applied';

export type RequestType = 'absence' | 'shift_swap' | 'new_shift' | 'modify_shift';

export interface RequestRow {
  id: string;
  type: RequestType;
  status: RequestStatus;
  payload: Record<string, unknown> | null;
  resolvedNotes: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  userId: string;
  userFirstName?: string;
  userLastName?: string;
}

export interface RequestListResponse {
  data: RequestRow[];
  total: number;
  page: number;
  limit: number;
}

export interface RequestFilters {
  status?: RequestStatus | 'all';
  type?: RequestType | 'all';
  userId?: string;
  page?: number;
  limit?: number;
}

/**
 * Risposta GET /api/requests/:id/impact — anteprima impatto sul planning
 * prima dell'approvazione (TSK-020, RB-14).
 * L'endpoint non è ancora implementato (G-009) — il FE gestisce il fallback gracefully.
 */
export interface ImpactViolation {
  ruleId: string;
  message: string;
}

export interface ImpactResult {
  blocking: ImpactViolation[];
  warnings: ImpactViolation[];
  summary: string;
}

/**
 * Errore strutturato 409 da POST /api/requests/:id/approve.
 * Lanciato da useApproveRequest quando il BE riporta violazioni bloccanti RB-14.
 */
export class ApprovalBlockedError extends Error {
  readonly blocking: ImpactViolation[];

  constructor(blocking: ImpactViolation[]) {
    super('Approvazione bloccata da violazioni di regola');
    this.name = 'ApprovalBlockedError';
    this.blocking = blocking;
  }
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const requestKeys = {
  all: ['requests'] as const,
  list: (filters?: RequestFilters) => ['requests', 'list', filters] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
  impact: (id: string) => ['requests', 'impact', id] as const,
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchRequests(filters?: RequestFilters): Promise<RequestListResponse> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters?.userId) params.set('userId', filters.userId);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/api/requests${query}`);
  if (!res.ok) {
    throw new Error(`Errore nel caricamento richieste: ${res.status}`);
  }
  const json = (await res.json()) as RequestListResponse;
  return json;
}

async function fetchRequestById(id: string): Promise<RequestRow> {
  const res = await fetch(`/api/requests/${id}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error('Richiesta non trovata');
    throw new Error(`Errore nel caricamento della richiesta: ${res.status}`);
  }
  const json = (await res.json()) as RequestRow;
  return json;
}

async function fetchRequestImpact(id: string): Promise<ImpactResult> {
  const res = await fetch(`/api/requests/${id}/impact`);
  if (!res.ok) {
    // Endpoint non ancora implementato (G-009) — restituisce un risultato vuoto
    if (res.status === 404 || res.status === 501) {
      return { blocking: [], warnings: [], summary: '' };
    }
    throw new Error(`Errore nel calcolo impatto: ${res.status}`);
  }
  const json = (await res.json()) as { data: ImpactResult };
  return json.data;
}

// ---------------------------------------------------------------------------
// useRequests — lista richieste con filtri opzionali
// ---------------------------------------------------------------------------

export function useRequests(filters?: RequestFilters) {
  return useQuery<RequestListResponse>({
    queryKey: requestKeys.list(filters),
    queryFn: () => fetchRequests(filters),
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useRequestDetail — singola richiesta (GET /api/requests/:id)
// ---------------------------------------------------------------------------

export function useRequestDetail(id: string) {
  return useQuery<RequestRow>({
    queryKey: requestKeys.detail(id),
    queryFn: () => fetchRequestById(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });
}

// ---------------------------------------------------------------------------
// useRequestImpact — anteprima impatto (GET /api/requests/:id/impact)
// ---------------------------------------------------------------------------

export function useRequestImpact(id: string) {
  return useQuery<ImpactResult>({
    queryKey: requestKeys.impact(id),
    queryFn: () => fetchRequestImpact(id),
    staleTime: 30 * 1000,
    enabled: !!id,
    // Non rethrow su 404/501 — fallback a empty result (G-009)
    retry: false,
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
      return res.json() as Promise<RequestRow>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useApproveRequest — POST /api/requests/{id}/approve
// Gestisce 409 (RB-14 blocking violations) lanciando ApprovalBlockedError.
// ---------------------------------------------------------------------------

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ResolveRequestInput }) => {
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        // RB-14 rivalidazione: violazioni bloccanti restituiscono 409
        const body = (await res.json().catch(() => ({ blocking: [] }))) as {
          blocking?: ImpactViolation[];
        };
        throw new ApprovalBlockedError(body.blocking ?? []);
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }

      return res.json() as Promise<RequestRow>;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// useRejectRequest — POST /api/requests/{id}/reject
// ---------------------------------------------------------------------------

export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ResolveRequestInput }) => {
      const res = await fetch(`/api/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }
      return res.json() as Promise<RequestRow>;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// useCancelRequest — POST /api/requests/{id}/cancel (dipendente, RB-16)
// Visibile solo se status IN ('draft', 'sent').
// Restituisce 409 se la richiesta non è annullabile (T-REQ-04).
// ---------------------------------------------------------------------------

export class CancelNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancelNotAllowedError';
  }
}

export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/requests/${id}/cancel`, {
        method: 'POST',
      });

      if (res.status === 409) {
        // T-REQ-04: richiesta non più annullabile (es. status=applied)
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new CancelNotAllowedError(
          body.error ?? 'Non più annullabile: la richiesta è già stata applicata'
        );
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }

      return res.json() as Promise<RequestRow>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useAcceptSwap — POST /api/requests/{id}/accept-swap (collega destinatario)
// T-SEC-08: il componente DEVE verificare session.user.id === payload.targetUserId
// prima di mostrare il bottone.
// ---------------------------------------------------------------------------

export function useAcceptSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string | null }) => {
      const res = await fetch(`/api/requests/${id}/accept-swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes ?? null }),
      });

      if (res.status === 403) {
        throw new Error('Non sei autorizzato ad accettare questo scambio');
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }

      return res.json() as Promise<RequestRow>;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// useRejectSwap — POST /api/requests/{id}/reject-swap (collega destinatario)
// GAP-TSK022-001: endpoint non ancora implementato lato BE.
// Il FE gestisce 404/501 con graceful degradation.
// ---------------------------------------------------------------------------

export function useRejectSwap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string | null }) => {
      const res = await fetch(`/api/requests/${id}/reject-swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes ?? null }),
      });

      // GAP-TSK022-001: endpoint non ancora implementato
      if (res.status === 404 || res.status === 501) {
        throw new Error('Funzionalità non ancora disponibile (GAP-TSK022-001)');
      }

      if (res.status === 403) {
        throw new Error('Non sei autorizzato a rifiutare questo scambio');
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore ${res.status}`);
      }

      return res.json() as Promise<RequestRow>;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: requestKeys.all });
      void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) });
    },
  });
}
