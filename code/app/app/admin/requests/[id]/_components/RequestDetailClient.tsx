'use client';

/**
 * app/(admin)/requests/[id]/_components/RequestDetailClient.tsx
 *
 * Client component per la pagina dettaglio richiesta admin.
 *
 * Usa TanStack Query per:
 *   - Dati richiesta (useRequestDetail)
 *   - Anteprima impatto (useRequestImpact — consuma ApprovalImpactPanel)
 *
 * SSE: useNotifications() è già attivo nel layout admin — la query verrà
 * invalidata automaticamente su eventi request.approved, request.rejected,
 * swap.accepted (T-INT-03).
 *
 * Layout:
 *   - Colonna principale: RequestDetail + SwapColleagueStatus + ApprovalImpactPanel
 *   - Colonna laterale (desktop): ApprovalActions
 *   - Mobile: stacked vertical
 *
 * Accessibility (WCAG 2.2 AA):
 *   - aria-busy su skeleton
 *   - Focus management: back link accessibile
 *   - Landmark <main> fornito dal layout admin
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRequestDetail } from '@/hooks/useRequests';
import { RequestDetail } from '@/components/requests/RequestDetail';
import { ApprovalImpactPanel } from '@/components/requests/ApprovalImpactPanel';
import { ApprovalActions } from '@/components/requests/ApprovalActions';
import { SwapColleagueStatus } from '@/components/requests/SwapColleagueStatus';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestDetailClientProps {
  requestId: string;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RequestDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Caricamento dettaglio richiesta">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
      <div className="border-border space-y-4 rounded-lg border p-6">
        <div className="h-6 w-1/3 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-20 w-full animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestDetailClient({ requestId }: RequestDetailClientProps) {
  const { data: request, isLoading, isError, error } = useRequestDetail(requestId);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/requests"
          className="focus:ring-ring inline-flex items-center gap-1.5 rounded text-sm text-gray-500 hover:text-gray-700 focus:ring-2 focus:outline-none"
          aria-label="Torna alla coda approvazioni"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Coda approvazioni
        </Link>
        <RequestDetailSkeleton />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------
  if (isError || !request) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/requests"
          className="focus:ring-ring inline-flex items-center gap-1.5 rounded text-sm text-gray-500 hover:text-gray-700 focus:ring-2 focus:outline-none"
          aria-label="Torna alla coda approvazioni"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Coda approvazioni
        </Link>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="mb-1 text-sm font-semibold text-red-800">
            Errore nel caricamento della richiesta
          </p>
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Richiesta non trovata o non accessibile.'}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/requests"
        className="focus:ring-ring inline-flex items-center gap-1.5 rounded text-sm text-gray-500 transition-colors hover:text-gray-700 focus:ring-2 focus:outline-none"
        aria-label="Torna alla coda approvazioni"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Coda approvazioni
      </Link>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dettaglio richiesta</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revisiona i dettagli e gestisci l&apos;approvazione
        </p>
      </div>

      {/* Layout a 2 colonne su desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonna principale (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dettaglio richiesta */}
          <RequestDetail request={request} />

          {/* Stato collega (solo per shift_swap in awaiting_colleague) */}
          <SwapColleagueStatus request={request} />

          {/* Anteprima impatto (solo se actionable) */}
          {request.status === 'sent' && <ApprovalImpactPanel requestId={requestId} />}
        </div>

        {/* Sidebar azioni (1/3) */}
        <div className="lg:col-span-1">
          <ApprovalActions
            requestId={requestId}
            request={request}
            onApproved={() => {
              // TanStack Query invalida automaticamente dopo mutation
            }}
            onRejected={() => {
              // TanStack Query invalida automaticamente dopo mutation
            }}
          />
        </div>
      </div>
    </div>
  );
}
