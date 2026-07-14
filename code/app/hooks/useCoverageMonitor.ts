'use client';

/**
 * hooks/useCoverageMonitor.ts — TanStack Query hook per il monitor di copertura (TSK-018).
 *
 * Consuma:
 *   GET /api/admin/coverage/monitor?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * RF-H CA1, CA2 — aggiornamento live tramite invalidazione query SSE (useNotifications).
 */

import { useQuery } from '@tanstack/react-query';

export interface CoverageMonitorItem {
  date: string; // YYYY-MM-DD
  shiftTypeId: string | null;
  shiftTypeName: string | null;
  shiftTypeCode: string | null;
  qualificationId: string;
  qualificationName: string;
  required: number;
  actual: number;
  deficit: number; // actual - required (negativo = sotto-copertura)
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const coverageMonitorKeys = {
  all: ['coverage-monitor'] as const,
  period: (from: string, to: string) => ['coverage-monitor', from, to] as const,
};

// ---------------------------------------------------------------------------
// useCoverageMonitor
// ---------------------------------------------------------------------------

export function useCoverageMonitor(from: string, to: string) {
  return useQuery<CoverageMonitorItem[]>({
    queryKey: coverageMonitorKeys.period(from, to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/coverage/monitor?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Errore monitor copertura: ${res.status}`);
      }
      return res.json() as Promise<CoverageMonitorItem[]>;
    },
    staleTime: 20 * 1000,
    enabled: !!from && !!to,
  });
}
