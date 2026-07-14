import type { Metadata } from 'next';
import { InboxBadge } from '@/components/dashboard/InboxBadge';
import { CoverageAlertList } from '@/components/dashboard/CoverageAlertList';
import { ViolationSummary } from '@/components/dashboard/ViolationSummary';
import { OvertimeSummaryCard } from '@/components/dashboard/OvertimeSummaryCard';
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { AbsenceCountCard } from '@/components/dashboard/AbsenceCountCard';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panoramica operativa — KPI turni, richieste e copertura',
};

/**
 * app/(admin)/dashboard/page.tsx — Dashboard operativa admin (TSK-014, RF-K).
 *
 * Server Component: rendering lato server del layout, nessuna logica di fetch
 * diretta (i KPI vengono caricati dai singoli client component via TanStack Query).
 *
 * KPI mostrati:
 *   1. Richieste in attesa      — InboxBadge (SSE + refetchInterval 60s)
 *   2. Fasce sotto-coperte      — CoverageAlertList
 *   3. Violazioni aperte        — ViolationSummary
 *   4. Ore straordinario        — OvertimeSummaryCard
 *   5. Assenze in corso         — AbsenceCountCard
 *
 * Layout responsive: 2 colonne su mobile (sm:grid-cols-2), 3 su desktop (lg:grid-cols-3).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Landmark <main> fornito dal layout admin
 *   - Regioni <section> con aria-label per ogni blocco semantico
 *   - Focus order logico: heading → KPI cards → azioni rapide (Tab)
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Heading */}
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Panoramica operativa — turni, copertura e richieste in attesa
        </p>
      </div>

      {/* KPI grid
          Mobile: 2 colonne | Desktop: 3 colonne (RF-K, criteri di accettazione) */}
      <section aria-label="Indicatori di performance operativi">
        <h2 className="sr-only">KPI operativi</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {/* 1. Richieste in attesa (InboxBadge con SSE) */}
          <InboxBadge />

          {/* 2. Violazioni aperte */}
          <ViolationSummary />

          {/* 3. Assenze in corso */}
          <AbsenceCountCard />

          {/* 4. Ore straordinario settimana */}
          <OvertimeSummaryCard />

          {/* 5. Fasce sotto-coperte — span su 2 colonne per mostrare la lista */}
          <div className="col-span-2 lg:col-span-2">
            <CoverageAlertList />
          </div>
        </div>
      </section>

      {/* Azioni rapide */}
      <section aria-label="Azioni rapide">
        <QuickActionsBar />
      </section>
    </div>
  );
}
