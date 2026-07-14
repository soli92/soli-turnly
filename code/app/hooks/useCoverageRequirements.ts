'use client';

/**
 * hooks/useCoverageRequirements.ts — TanStack Query hooks per i fabbisogni di copertura (TSK-018).
 *
 * Consuma:
 *   GET    /api/admin/coverage-requirements          → lista regole
 *   POST   /api/admin/coverage-requirements          → crea regola
 *   PATCH  /api/admin/coverage-requirements/:id      → modifica regola
 *   DELETE /api/admin/coverage-requirements/:id      → elimina regola
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverageRequirementCreateInput, CoverageRequirementPatchInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface CoverageRequirementRow {
  id: string;
  qualificationId: string;
  qualificationName: string | null;
  qualificationColor: string | null;
  shiftTypeId: string | null;
  shiftTypeName: string | null;
  shiftTypeCode: string | null;
  shiftTypeColor: string | null;
  dayOfWeek: number | null; // 0=domenica … 6=sabato; null = tutti i giorni
  minimumCount: number;
  notes: string | null;
  createdAt: string;
}

interface ApiErrorBody {
  error?: string;
  issues?: Array<{ path: string[]; message: string }>;
  hasActiveShifts?: boolean;
}

export class CoverageReqApiError extends Error {
  issues?: Array<{ path: string[]; message: string }>;
  hasActiveShifts?: boolean;

  constructor(
    message: string,
    issues?: Array<{ path: string[]; message: string }>,
    hasActiveShifts?: boolean
  ) {
    super(message);
    this.name = 'CoverageReqApiError';
    if (issues !== undefined) this.issues = issues;
    if (hasActiveShifts !== undefined) this.hasActiveShifts = hasActiveShifts;
  }
}

function toApiError(body: ApiErrorBody, status: number): CoverageReqApiError {
  return new CoverageReqApiError(
    body.error ?? `Errore ${status}`,
    body.issues,
    body.hasActiveShifts
  );
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const coverageReqKeys = {
  all: ['coverage-requirements'] as const,
  list: () => ['coverage-requirements', 'list'] as const,
};

// ---------------------------------------------------------------------------
// useCoverageRequirements — lista regole
// ---------------------------------------------------------------------------

export function useCoverageRequirements() {
  return useQuery<CoverageRequirementRow[]>({
    queryKey: coverageReqKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/admin/coverage-requirements');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw new CoverageReqApiError(body.error ?? `Errore API: ${res.status}`);
      }
      return res.json() as Promise<CoverageRequirementRow[]>;
    },
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// useCreateCoverageRequirement
// ---------------------------------------------------------------------------

export function useCreateCoverageRequirement() {
  const queryClient = useQueryClient();

  return useMutation<CoverageRequirementRow, CoverageReqApiError, CoverageRequirementCreateInput>({
    mutationFn: async (data) => {
      const res = await fetch('/api/admin/coverage-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<CoverageRequirementRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coverageReqKeys.all });
      queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateCoverageRequirement
// ---------------------------------------------------------------------------

export function useUpdateCoverageRequirement() {
  const queryClient = useQueryClient();

  return useMutation<
    CoverageRequirementRow,
    CoverageReqApiError,
    { id: string; data: CoverageRequirementPatchInput }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/admin/coverage-requirements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<CoverageRequirementRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coverageReqKeys.all });
      queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteCoverageRequirement
// ---------------------------------------------------------------------------

export function useDeleteCoverageRequirement() {
  const queryClient = useQueryClient();

  return useMutation<
    { deleted: boolean; id: string },
    CoverageReqApiError,
    { id: string; force?: boolean }
  >({
    mutationFn: async ({ id, force = false }) => {
      const url = `/api/admin/coverage-requirements/${id}${force ? '?force=1' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
        throw toApiError(body, res.status);
      }
      return res.json() as Promise<{ deleted: boolean; id: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coverageReqKeys.all });
      queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
    },
  });
}
