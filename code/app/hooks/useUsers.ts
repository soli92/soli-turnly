'use client';

/**
 * hooks/useUsers.ts — TanStack Query hooks per la gestione utenti.
 *
 * Consuma:
 *   GET   /api/admin/users    → lista utenti (admin only)
 *   GET   /api/users/me       → utente corrente
 *   PATCH /api/users/me       → aggiorna profilo utente corrente
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserPatchInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi risposta API
// ---------------------------------------------------------------------------

export interface UserRow {
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

export interface MeRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'employee';
  qualificationId: string | null;
  qualificationName: string | null;
  contractHours: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const userKeys = {
  all: ['users'] as const,
  adminList: () => ['users', 'admin-list'] as const,
  me: () => ['users', 'me'] as const,
};

// ---------------------------------------------------------------------------
// useUsers — GET /api/admin/users (admin only)
// ---------------------------------------------------------------------------

export function useUsers() {
  return useQuery<UserRow[]>({
    queryKey: userKeys.adminList(),
    queryFn: async () => {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error(`Errore nel caricamento utenti: ${res.status}`);
      }
      const json = (await res.json()) as { data: UserRow[] };
      return json.data;
    },
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useMe — GET /api/users/me
// ---------------------------------------------------------------------------

export function useMe() {
  return useQuery<MeRow>({
    queryKey: userKeys.me(),
    queryFn: async () => {
      const res = await fetch('/api/users/me');
      if (!res.ok) {
        throw new Error(`Errore nel caricamento profilo: ${res.status}`);
      }
      return res.json() as Promise<MeRow>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// usePatchMe — PATCH /api/users/me
// ---------------------------------------------------------------------------

export function usePatchMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserPatchInput) => {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
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
      return res.json() as Promise<MeRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.me() });
    },
  });
}
