'use client';

/**
 * components/employee/requests/SwapReceivedCard.tsx
 *
 * Card speciale per una proposta di scambio turno ricevuta da un collega.
 *
 * Mostra:
 *   - Nome richiedente
 *   - Turno del richiedente (da cedere al dipendente)
 *   - Turno del dipendente corrente (da cedere al richiedente)
 *   - Stato corrente della richiesta
 *   - SwapAcceptRejectPanel se status='awaiting_colleague'
 *
 * Nota: questo componente è usato per lo scenario "ricevuto da collega".
 * Richiede il parametro `received_swap=true` lato BE — vedi GAP-TSK022-002.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="article" per la card
 *   - aria-label descrittivo
 *
 * data-testid: swap-received-card
 */

import { ArrowLeftRight } from 'lucide-react';
import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { SwapAcceptRejectPanel } from './SwapAcceptRejectPanel';
import type { RequestRow } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SwapPayload {
  targetUserId?: string;
  targetUserFirstName?: string;
  targetUserLastName?: string;
  requesterShiftDate?: string;
  targetShiftDate?: string;
  requesterShiftType?: string;
  targetShiftType?: string;
  requesterShiftStart?: string;
  requesterShiftEnd?: string;
  targetShiftStart?: string;
  targetShiftEnd?: string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(start?: string, end?: string): string {
  if (!start && !end) return '';
  const fmt = (dt?: string) =>
    dt
      ? new Date(dt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '?';
  return `${fmt(start)} – ${fmt(end)}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SwapReceivedCardProps {
  request: RequestRow;
  onActioned?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SwapReceivedCard({ request, onActioned }: SwapReceivedCardProps) {
  const payload = (request.payload ?? {}) as SwapPayload;

  const requesterName =
    request.userFirstName || request.userLastName
      ? `${request.userFirstName ?? ''} ${request.userLastName ?? ''}`.trim()
      : 'Un collega';

  const submittedDate = request.submittedAt
    ? new Date(request.submittedAt).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <article
      data-testid="swap-received-card"
      className="overflow-hidden rounded-lg border border-blue-200 bg-white shadow-sm"
      aria-label={`Proposta scambio da ${requesterName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-blue-900">Scambio da {requesterName}</p>
            {submittedDate && <p className="text-xs text-blue-600">Proposto il {submittedDate}</p>}
          </div>
        </div>
        <RequestStatusBadge status={request.status} size="sm" />
      </div>

      {/* Corpo */}
      <div className="space-y-4 p-4">
        {/* Confronto turni */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-0.5 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Turno di {requesterName}
            </p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(payload.requesterShiftDate)}
            </p>
            <p className="text-sm text-gray-700">
              {formatTime(payload.requesterShiftStart, payload.requesterShiftEnd)}
            </p>
            {payload.requesterShiftType && (
              <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                {payload.requesterShiftType}
              </span>
            )}
          </div>

          <div className="space-y-0.5 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Il tuo turno
            </p>
            <p className="text-sm font-medium text-gray-900">
              {formatDate(payload.targetShiftDate)}
            </p>
            <p className="text-sm text-gray-700">
              {formatTime(payload.targetShiftStart, payload.targetShiftEnd)}
            </p>
            {payload.targetShiftType && (
              <span className="inline-flex items-center rounded-full bg-blue-200 px-2 py-0.5 text-xs text-blue-700">
                {payload.targetShiftType}
              </span>
            )}
          </div>
        </div>

        {/* Pannello accetta/rifiuta — solo se awaiting_colleague */}
        {request.status === 'awaiting_colleague' && (
          <SwapAcceptRejectPanel request={request} onActioned={onActioned} />
        )}
      </div>
    </article>
  );
}
