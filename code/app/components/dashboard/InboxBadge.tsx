'use client';

/**
 * components/dashboard/InboxBadge.tsx — Badge richieste in attesa (TSK-014).
 *
 * KPI card specializzata per le richieste in attesa di approvazione.
 * Integra:
 *   - TanStack Query con refetchInterval 60s (RF-K CA2)
 *   - useNotifications() — invalida la query `requests` al `request.received` via SSE
 *     garantendo aggiornamento entro ~30s senza page refresh (T-INT-03)
 *   - Link a /admin/requests per accesso rapido alla coda
 *
 * API: GET /api/requests?status=sent&limit=1 — usa il campo `total` per il contatore.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Badge numerico con aria-label "N richieste in attesa"
 *   - Navigabile con Tab grazie all'href su KpiCard
 */

import { Inbox } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { KpiCard } from './KpiCard';

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface RequestsApiResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

async function fetchPendingRequestsCount(): Promise<{ value: number }> {
  const res = await fetch('/api/requests?status=sent&limit=1');
  if (!res.ok) throw new Error(`Errore API richieste: ${res.status}`);
  const json = (await res.json()) as RequestsApiResponse;
  return { value: json.total ?? json.data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// InboxBadge
// ---------------------------------------------------------------------------

export function InboxBadge() {
  // SSE subscription — invalida ['requests'] su `request.received`.
  // TanStack Query usa il matching per prefisso: ['requests', 'pending-count']
  // viene invalidata quando viene chiamato invalidateQueries({ queryKey: ['requests'] })
  // garantendo aggiornamento entro ~30s (T-INT-03, RF-K CA2).
  useNotifications();

  return (
    <KpiCard
      title="Richieste in attesa"
      icon={Inbox}
      iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
      queryKey={['requests', 'pending-count']}
      queryFn={fetchPendingRequestsCount}
      refetchInterval={60_000}
      href="/admin/requests"
      data-testid="kpi-inbox-badge"
    />
  );
}
