'use client';

/**
 * hooks/useStaff.ts — TanStack Query hooks per la gestione anagrafica dipendenti.
 *
 * Consuma:
 *   GET    /api/admin/users           → lista staff (admin only)
 *   POST   /api/admin/users           → crea dipendente
 *   PATCH  /api/admin/users/{id}      → modifica dipendente (incl. active: false RF-B CA2)
 *
 * Nota: GET /api/admin/users non restituisce qualificationName (join non implementato
 * nel route handler — RF-B gap TSK-016). Il RSC page.tsx passa qualificationName
 * come initialData via StaffPageClient. Al refetch successivo, qualificationName
 * sarà null per le righe senza join → i componenti gestiscono il fallback.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { AdminUserCreateInput, AdminUserPatchInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface StaffRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  qualificationId: string | null;
  qualificationName: string | null;
  contractHours: number;
  active: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const staffKeys = {
  all: ['staff'] as const,
  list: () => ['staff', 'list'] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ApiError = Error & { issues?: Array<{ path: string[]; message: string }> };

async function throwApiError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    issues?: Array<{ path: string[]; message: string }>;
  };
  const err = new Error(body.error ?? `Errore ${res.status}`) as ApiError;
  // exactOptionalPropertyTypes: assign only when defined
  if (body.issues) {
    err.issues = body.issues;
  }
  throw err;
}

// ---------------------------------------------------------------------------
// useStaff — GET /api/admin/users
// ---------------------------------------------------------------------------

export function useStaff(initialData?: StaffRow[]): UseQueryResult<StaffRow[], Error> {
  return useQuery<StaffRow[], Error, StaffRow[]>({
    queryKey: staffKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/users?limit=200');
      if (!res.ok) await throwApiError(res);
      const json = (await res.json()) as { data: StaffRow[] };
      return json.data;
    },
    // exactOptionalPropertyTypes: spread conditionally so initialData is absent (not undefined)
    ...(initialData !== undefined ? { initialData } : {}),
    staleTime: 60 * 1000,
  }) as UseQueryResult<StaffRow[], Error>;
}

// ---------------------------------------------------------------------------
// useCreateStaff — POST /api/admin/users
// ---------------------------------------------------------------------------

export function useCreateStaff() {
  const queryClient = useQueryClient();

  return useMutation<StaffRow, ApiError, AdminUserCreateInput>({
    mutationFn: async (data) => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwApiError(res);
      return res.json() as Promise<StaffRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
    },
  });
}

// ---------------------------------------------------------------------------
// usePatchStaff — PATCH /api/admin/users/{id}
// ---------------------------------------------------------------------------

export function usePatchStaff() {
  const queryClient = useQueryClient();

  return useMutation<StaffRow, ApiError, { id: string; data: AdminUserPatchInput }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) await throwApiError(res);
      return res.json() as Promise<StaffRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
    },
  });
}
