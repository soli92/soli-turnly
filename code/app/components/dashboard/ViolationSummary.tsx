'use client';

/**
 * components/dashboard/ViolationSummary.tsx — Contatore violazioni aperte (TSK-014).
 *
 * Mostra il numero di turni con violazioni delle regole di business (RB) attualmente
 * aperte (non risolte) nel periodo corrente.
 *
 * API: GET /api/shifts?hasViolations=true&from=<today>
 * Usa il campo `total` della response per il contatore.
 *
 * Nota: il parametro `hasViolations` sarà implementato completamente in TSK-006.
 * Fino ad allora la risposta potrebbe non filtrare correttamente, ma la UI
 * mostra comunque il dato ricevuto (non ha dati statici).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Card navigabile via Tab (href a /admin/matrix con filtro)
 *   - aria-label descrittivo su icona warning
 */

import { ShieldAlert } from 'lucide-react';
import { KpiCard } from './KpiCard';

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface ShiftsApiResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

async function fetchOpenViolationsCount(): Promise<{ value: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`/api/shifts?hasViolations=true&dateFrom=${today}&limit=1`);
  if (!res.ok) throw new Error(`Errore API turni (violazioni): ${res.status}`);
  const json = (await res.json()) as ShiftsApiResponse;
  return { value: json.total ?? json.data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// ViolationSummary
// ---------------------------------------------------------------------------

export function ViolationSummary() {
  return (
    <KpiCard
      title="Violazioni aperte"
      icon={ShieldAlert}
      iconClassName="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      queryKey={['shifts', 'violations-count']}
      queryFn={fetchOpenViolationsCount}
      href="/admin/matrix"
      data-testid="kpi-violation-summary"
    />
  );
}
