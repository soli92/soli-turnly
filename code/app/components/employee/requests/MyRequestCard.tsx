'use client';

/**
 * components/employee/requests/MyRequestCard.tsx
 *
 * Card singola richiesta dipendente nella lista "Le mie richieste".
 *
 * Mostra:
 *   - Badge tipo richiesta
 *   - Data invio (submittedAt)
 *   - Periodo richiesto (da payload.startDate/endDate se presenti)
 *   - Badge stato (RequestStatusBadge)
 *   - Azioni: link dettaglio + RequestCancelButton (se annullabile)
 *
 * Card speciale per shift_swap awaiting_colleague:
 *   - Mostra indicatore "In attesa del tuo collega"
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="article" su ogni card
 *   - aria-label descrittivo
 *
 * data-testid: my-request-card
 */

import Link from 'next/link';
import { ArrowRight, ArrowLeftRight, Clock } from 'lucide-react';
import { RequestStatusBadge } from '@/components/requests/RequestStatusBadge';
import { RequestCancelButton } from './RequestCancelButton';
import type { RequestRow, RequestType } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Costanti UI
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

const TYPE_BADGE_COLORS: Record<RequestType, string> = {
  absence: 'bg-orange-100 text-orange-700 border-orange-200',
  shift_swap: 'bg-blue-100 text-blue-700 border-blue-200',
  new_shift: 'bg-purple-100 text-purple-700 border-purple-200',
  modify_shift: 'bg-teal-100 text-teal-700 border-teal-200',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RequestPayload {
  startDate?: string;
  endDate?: string;
  date?: string;
  targetShiftDate?: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function extractPeriod(request: RequestRow): string | null {
  const payload = (request.payload ?? {}) as RequestPayload;

  if (payload.startDate && payload.endDate) {
    const start = formatDate(payload.startDate);
    const end = formatDate(payload.endDate);
    return start === end ? start : `${start} – ${end}`;
  }
  if (payload.startDate) return formatDate(payload.startDate);
  if (payload.date) return formatDate(payload.date);
  if (payload.targetShiftDate) return formatDate(payload.targetShiftDate);
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MyRequestCardProps {
  request: RequestRow;
  onCancelled?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function MyRequestCard({ request, onCancelled }: MyRequestCardProps) {
  const typeBadgeClass =
    TYPE_BADGE_COLORS[request.type] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const period = extractPeriod(request);
  const isAwaitingColleague =
    request.type === 'shift_swap' && request.status === 'awaiting_colleague';

  return (
    <article
      data-testid="my-request-card"
      className="group border-border rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md"
      aria-label={`Richiesta ${TYPE_LABELS[request.type] ?? request.type}, stato: ${request.status}`}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        {/* Colonna sinistra: tipo + dettagli */}
        <div className="min-w-0 flex-1 space-y-2">
          {/* Tipo badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                typeBadgeClass,
              ].join(' ')}
            >
              {request.type === 'shift_swap' && (
                <ArrowLeftRight className="mr-1 h-3 w-3" aria-hidden="true" />
              )}
              {TYPE_LABELS[request.type] ?? request.type}
            </span>

            {isAwaitingColleague && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                <Clock className="h-3 w-3" aria-hidden="true" />
                In attesa del collega
              </span>
            )}
          </div>

          {/* Data invio */}
          <p className="text-xs text-gray-500">
            Inviata:{' '}
            <time dateTime={request.submittedAt ?? undefined}>
              {formatDate(request.submittedAt)}
            </time>
          </p>

          {/* Periodo richiesto */}
          {period && (
            <p className="text-xs text-gray-600">
              Periodo: <span className="font-medium">{period}</span>
            </p>
          )}

          {/* Note risoluzione (se rifiutata/cancellata con note) */}
          {request.resolvedNotes && (
            <p className="max-w-xs truncate text-xs text-gray-500 italic">
              {request.resolvedNotes}
            </p>
          )}
        </div>

        {/* Colonna destra: stato + azioni */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <RequestStatusBadge status={request.status} />
        </div>
      </div>

      {/* Footer azioni */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
        <RequestCancelButton
          requestId={request.id}
          status={request.status}
          onCancelled={onCancelled}
        />

        <Link
          href={`/requests/${request.id}`}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
          aria-label={`Dettaglio richiesta ${TYPE_LABELS[request.type] ?? request.type}`}
        >
          Dettaglio
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
