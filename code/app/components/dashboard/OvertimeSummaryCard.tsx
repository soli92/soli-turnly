'use client';

/**
 * components/dashboard/OvertimeSummaryCard.tsx — Ore straordinario del periodo (TSK-014).
 *
 * Mostra il totale delle ore straordinario accumulate nella settimana corrente.
 *
 * API: GET /api/admin/reports/overtime?period=current_week
 *
 * NOTA GAP: questo endpoint non è ancora implementato (vedi wiki/gaps.md).
 * Il componente gestisce 404/501 con graceful degradation — mostra "N/D"
 * invece di un errore bloccante, per non degradare l'intera dashboard.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Suffix "h" con sr-only testo "ore" per screen-reader
 *   - Card non navigabile (nessun href) poiché la pagina report non esiste ancora
 */

import { Clock4 } from 'lucide-react';
import { KpiCard } from './KpiCard';

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface OvertimeApiResponse {
  totalHours: number;
  period: string;
  changePercent?: number;
}

async function fetchOvertimeSummary(): Promise<{
  value: number | string;
  suffix: string;
  change?: number;
}> {
  const res = await fetch('/api/admin/reports/overtime?period=current_week');

  // Graceful degradation: endpoint non ancora implementato (TSK gap)
  if (res.status === 404 || res.status === 501) {
    return { value: 'N/D', suffix: '' };
  }

  if (!res.ok) throw new Error(`Errore API overtime: ${res.status}`);

  const json = (await res.json()) as OvertimeApiResponse;
  return {
    value: json.totalHours,
    suffix: 'h',
    // exactOptionalPropertyTypes: omit key when undefined
    ...(json.changePercent !== undefined ? { change: json.changePercent } : {}),
  };
}

// ---------------------------------------------------------------------------
// OvertimeSummaryCard
// ---------------------------------------------------------------------------

export function OvertimeSummaryCard() {
  return (
    <KpiCard
      title="Ore straordinario (settimana)"
      icon={Clock4}
      iconClassName="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
      queryKey={['reports', 'overtime', 'current-week']}
      queryFn={fetchOvertimeSummary}
      data-testid="kpi-overtime-summary"
    />
  );
}
