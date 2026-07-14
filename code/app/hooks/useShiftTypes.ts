'use client';

/**
 * hooks/useShiftTypes.ts — TanStack Query hooks per la gestione tipologie turno.
 *
 * Consuma:
 *   GET    /api/shift-types          → lista tipologie attive
 *   POST   /api/shift-types          → crea tipologia (admin only)
 *   PATCH  /api/shift-types/:id      → modifica tipologia (admin only)
 *   DELETE /api/shift-types/:id      → soft delete / disattivazione (admin only)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ShiftTypeCreateInput, ShiftTypePatchInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipo riga completa (tutti i campi ritornati da GET /api/shift-types)
// ---------------------------------------------------------------------------

export interface ShiftTypeFullRow {
  id: string;
  name: string;
  code: string;
  color: string;
  defaultStartTime: string; // HH:MM
  defaultEndTime: string; // HH:MM
  breakMinutes: number;
  active: boolean;
}

interface ApiErrorBody {
  error?: string;
  issues?: Array<{ path: string[]; message: string }>;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const shiftTypeKeys = {
  all: ['shift-types'] as const,
  list: () => ['shift-types', 'list'] as const,
  detail: (id: string) => ['shift-types', 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchShiftTypes(): Promise<ShiftTypeFullRow[]> {
  const res = await fetch('/api/shift-types');
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error ?? `Errore API tipologie turno: ${res.status}`);
  }
  return res.json() as Promise<ShiftTypeFullRow[]>;
}

// ---------------------------------------------------------------------------
// Tipo errore arricchito con issues Zod
// ---------------------------------------------------------------------------

export class ShiftTypeApiError extends Error {
  issues?: Array<{ path: string[]; message: string }>;

  constructor(message: string, issues?: Array<{ path: string[]; message: string }>) {
    super(message);
    this.name = 'ShiftTypeApiError';
    if (issues !== undefined) {
      this.issues = issues;
    }
  }
}

function toApiError(body: ApiErrorBody, status: number): ShiftTypeApiError {
  return new ShiftTypeApiError(body.error ?? `Errore ${status}`, body.issues);
}

// ---------------------------------------------------------------------------
// useShiftTypes — lista tipologie attive
// ---------------------------------------------------------------------------

export function useShiftTypes() {
  return useQuery<ShiftTypeFullRow[]>({
    queryKey: shiftTypeKeys.list(),
    queryFn: fetchShiftTypes,
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useCreateShiftType — POST /api/shift-types
// ---------------------------------------------------------------------------

export function useCreateShiftType() {
  const queryClient = useQueryClient();

  return useMutation<ShiftTypeFullRow, ShiftTypeApiError, ShiftTypeCreateInput>({
    mutationFn: async (data) => {
      const res = await fetch('/api/shift-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<ShiftTypeFullRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftTypeKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateShiftType — PATCH /api/shift-types/:id
// ---------------------------------------------------------------------------

export function useUpdateShiftType() {
  const queryClient = useQueryClient();

  return useMutation<
    ShiftTypeFullRow,
    ShiftTypeApiError,
    { id: string; data: ShiftTypePatchInput }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/shift-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<ShiftTypeFullRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftTypeKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeactivateShiftType — PATCH /api/shift-types/:id {active: false}
// Usato per tipologie in uso (con turni associati): soft disable (RF-C CA2).
// ---------------------------------------------------------------------------

export function useDeactivateShiftType() {
  const queryClient = useQueryClient();

  return useMutation<string, ShiftTypeApiError, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/shift-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftTypeKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteShiftType — DELETE /api/shift-types/:id
// Usato per tipologie senza turni associati (RF-C CA2).
// Il BE esegue soft delete (active = false).
// ---------------------------------------------------------------------------

export function useDeleteShiftType() {
  const queryClient = useQueryClient();

  return useMutation<string, ShiftTypeApiError, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/shift-types/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftTypeKeys.all });
    },
  });
}
