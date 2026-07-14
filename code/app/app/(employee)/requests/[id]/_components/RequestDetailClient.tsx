'use client';

/**
 * app/(employee)/requests/[id]/_components/RequestDetailClient.tsx
 *
 * Client component per il dettaglio di una singola richiesta dipendente.
 *
 * Compone:
 *   - Header con tipo e stato
 *   - RequestTimeline (cronologia stati)
 *   - Payload dettagli (dates, notes, swap info)
 *   - RequestCancelButton (se stato consente annullamento)
 *   - SwapAcceptRejectPanel (se scambio ricevuto dal collega e status=awaiting_colleague)
 *   - Note di risoluzione (se risoluta)
 *
 * Aggiornamento real-time: useNotifications() è attivo nel layout → invalida
 * automaticamente ['requests', 'detail', id] su eventi request.approved / request.rejected.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - section con aria-labelledby
 *   - role="status" per badge stato
 *
 * data-testid: request-detail-client
 */

import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useRequestDetail } from '@/hooks/useRequests';
import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { RequestTimeline } from '@/components/employee/requests/RequestTimeline';
import { RequestCancelButton } from '@/components/employee/requests/RequestCancelButton';
import { SwapAcceptRejectPanel } from '@/components/employee/requests/SwapAcceptRejectPanel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RequestType } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PayloadEntry {
  key: string;
  value: string;
}

const PAYLOAD_KEY_LABELS: Record<string, string> = {
  startDate: 'Data inizio',
  endDate: 'Data fine',
  date: 'Data',
  notes: 'Note',
  targetShiftId: 'Turno da scambiare',
  requesterShiftId: 'Tuo turno',
  targetUserId: 'Collega',
  targetUserFirstName: 'Nome collega',
  targetUserLastName: 'Cognome collega',
  absenceType: 'Tipo assenza',
  reason: 'Motivo',
};

function flattenPayload(payload: Record<string, unknown> | null): PayloadEntry[] {
  if (!payload) return [];
  // Esclude campi tecnici (ID interni) dal display principale
  const HIDDEN_KEYS = ['targetUserId', 'requesterShiftId', 'targetShiftId'];
  return Object.entries(payload)
    .filter(([key]) => !HIDDEN_KEYS.includes(key) && payload[key] != null)
    .map(([key, value]) => ({
      key: PAYLOAD_KEY_LABELS[key] ?? key,
      value: String(value),
    }));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestDetailClientProps {
  id: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestDetailClient({ id }: RequestDetailClientProps) {
  const { data: request, isLoading, isError, error, refetch } = useRequestDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Caricamento dettaglio richiesta">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          {error instanceof Error ? error.message : 'Richiesta non trovata'}
        </p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
          Riprova
        </Button>
      </div>
    );
  }

  const typeLabel = TYPE_LABELS[request.type] ?? request.type;
  const payloadEntries = flattenPayload(request.payload);

  return (
    <div data-testid="request-detail-client" className="max-w-2xl space-y-6">
      {/* Link torna alla lista */}
      <Link
        href="/requests"
        className="inline-flex items-center gap-1 rounded text-sm text-blue-600 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
        aria-label="Torna alla lista richieste"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Le mie richieste
      </Link>

      {/* Intestazione richiesta */}
      <section aria-labelledby="request-detail-heading">
        <div className="border-border space-y-4 rounded-lg border bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="request-detail-heading" className="text-lg font-semibold text-gray-900">
                {typeLabel}
              </h2>
              {request.submittedAt && (
                <p className="mt-0.5 text-sm text-gray-500">
                  Inviata il{' '}
                  <time dateTime={request.submittedAt}>{formatDate(request.submittedAt)}</time>
                </p>
              )}
            </div>
            <RequestStatusBadge status={request.status} />
          </div>

          {/* Payload dettagli */}
          {payloadEntries.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Dettagli richiesta
              </p>
              <dl className="space-y-1">
                {payloadEntries.map((entry) => (
                  <div key={entry.key} className="flex gap-2 text-sm">
                    <dt className="shrink-0 font-medium text-gray-600">{entry.key}:</dt>
                    <dd className="break-words text-gray-800">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Note di risoluzione */}
          {request.resolvedNotes && (
            <div
              className={[
                'flex items-start gap-2 rounded-md p-3',
                request.status === 'approved' || request.status === 'applied'
                  ? 'border border-green-200 bg-green-50'
                  : 'border border-red-200 bg-red-50',
              ].join(' ')}
            >
              {request.status === 'approved' || request.status === 'applied' ? (
                <CheckCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                  aria-hidden="true"
                />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
              )}
              <div>
                <p className="text-xs font-medium text-gray-700">Note del responsabile</p>
                <p className="mt-0.5 text-sm text-gray-800">{request.resolvedNotes}</p>
                {request.resolvedAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    <time dateTime={request.resolvedAt}>{formatDate(request.resolvedAt)}</time>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Azione annullamento */}
          <div className="flex items-center justify-between gap-3">
            <RequestCancelButton
              requestId={request.id}
              status={request.status}
              onCancelled={() => void refetch()}
            />

            {(request.status === 'sent' || request.status === 'awaiting_colleague') && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                In attesa di risposta
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Timeline cronologia */}
      <section aria-labelledby="timeline-heading">
        <div className="border-border rounded-lg border bg-white p-5">
          <h2 id="timeline-heading" className="mb-4 text-sm font-semibold text-gray-700">
            Cronologia
          </h2>
          <RequestTimeline request={request} />
        </div>
      </section>

      {/* Pannello scambio ricevuto (se applicabile) */}
      {request.type === 'shift_swap' && request.status === 'awaiting_colleague' && (
        <section aria-labelledby="swap-panel-heading">
          <div className="space-y-2">
            <h2 id="swap-panel-heading" className="text-sm font-semibold text-gray-700">
              Proposta di scambio ricevuta
            </h2>
            <SwapAcceptRejectPanel request={request} onActioned={() => void refetch()} />
          </div>
        </section>
      )}
    </div>
  );
}
