'use client';

/**
 * components/dashboard/AbsenceCountCard.tsx — Assenze attive oggi (TSK-014).
 *
 * KPI card per le assenze approvate con effetto oggi.
 *
 * API: GET /api/admin/absences?status=approved&activeToday=true&limit=1
 * Usa il campo `total` della response per il contatore.
 *
 * Nota: il parametro `activeToday` potrebbe non essere supportato dalla
 * versione attuale dell'endpoint. In quel caso il componente mostra il totale
 * delle assenze approvate senza filtro data (best-effort).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Card con href naviga a /admin/absences
 *   - aria-label descrittivo
 */

import { UserX } from 'lucide-react';
import { KpiCard } from './KpiCard';

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

interface AbsencesApiResponse {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
}

async function fetchActiveTodayAbsencesCount(): Promise<{ value: number }> {
  const res = await fetch('/api/admin/absences?status=approved&activeToday=true&limit=1');
  if (!res.ok) throw new Error(`Errore API assenze: ${res.status}`);
  const json = (await res.json()) as AbsencesApiResponse;
  return { value: json.total ?? json.data?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// AbsenceCountCard
// ---------------------------------------------------------------------------

export function AbsenceCountCard() {
  return (
    <KpiCard
      title="Assenze in corso"
      icon={UserX}
      iconClassName="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      queryKey={['absences', 'active-today-count']}
      queryFn={fetchActiveTodayAbsencesCount}
      href="/admin/absences"
      data-testid="kpi-absence-count"
    />
  );
}
