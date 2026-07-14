'use client';

/**
 * hooks/useOvertimeReport.ts — TanStack Query hook per il report straordinari (TSK-027).
 *
 * Consuma:
 *   GET /api/admin/reports/overtime?from=YYYY-MM-DD&to=YYYY-MM-DD[&userId=<uuid>][&page=N][&limit=N]
 *
 * RF-I — Report ore straordinarie.
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type {
  OvertimeReportRow,
  OvertimeReportResponse,
} from '@/app/api/admin/reports/overtime/route';

// ---------------------------------------------------------------------------
// Re-export del tipo riga per i consumer
// ---------------------------------------------------------------------------

export type { OvertimeReportRow };

// ---------------------------------------------------------------------------
// Parametri filtro
// ---------------------------------------------------------------------------

export interface OvertimeReportFilters {
  /** Data inizio periodo — YYYY-MM-DD (obbligatoria) */
  from: string;
  /** Data fine periodo — YYYY-MM-DD (obbligatoria) */
  to: string;
  /** Filtra per singolo dipendente (opzionale) */
  // NOTE: esplicito string | undefined per compatibilità con exactOptionalPropertyTypes.
  userId?: string | undefined;
  /** Pagina (default 1) */
  page?: number;
  /** Numero righe per pagina (default 50) */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const overtimeReportKeys = {
  all: ['overtime-report'] as const,
  list: (filters: OvertimeReportFilters) => ['overtime-report', 'list', filters] as const,
};

// ---------------------------------------------------------------------------
// useOvertimeReport — GET /api/admin/reports/overtime
// ---------------------------------------------------------------------------

/**
 * Fetcha il report straordinari per il periodo e i filtri indicati.
 *
 * @param filters - from, to, userId opzionale, paginazione
 * @param options - override UseQueryOptions
 */
export function useOvertimeReport(
  filters: OvertimeReportFilters,
  options?: Partial<UseQueryOptions<OvertimeReportResponse>>
) {
  const enabled = Boolean(filters.from && filters.to);

  return useQuery<OvertimeReportResponse>({
    queryKey: overtimeReportKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('from', filters.from);
      params.set('to', filters.to);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const res = await fetch(`/api/admin/reports/overtime?${params.toString()}`);

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: unknown;
        };
        throw new Error(body.error ?? `Errore ${res.status} ${res.statusText}`);
      }

      return res.json() as Promise<OvertimeReportResponse>;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minuti — dati aggregati, non real-time
    ...options,
  });
}
