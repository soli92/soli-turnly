'use client';

/**
 * components/requests/RequestDetail.tsx — Scheda dettaglio richiesta.
 *
 * Mostra in sola lettura:
 *   - Tipo richiesta + badge stato
 *   - Richiedente (nome + cognome)
 *   - Data invio
 *   - Payload (specifico per tipo, in formato key-value)
 *   - Note di risoluzione (se approvata / rifiutata)
 *   - Data e autore della risoluzione
 *   - Banner "Richiesta applicata" se status === 'applied' (RB-16, T-REQ-04)
 *
 * Accessibility (WCAG 2.2 AA):
 *   - dl/dt/dd semantici per la lista di dettagli
 *   - Landmark <article> con aria-label
 *
 * data-testid: request-detail
 */

import { CheckCircle2, Clock, User, Calendar, FileText } from 'lucide-react';
import { RequestStatusBadge } from './RequestStatusBadge';
import type { RequestRow, RequestType } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Richiesta di assenza',
  shift_swap: 'Richiesta di scambio turno',
  new_shift: 'Richiesta nuovo turno',
  modify_shift: 'Richiesta modifica turno',
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Converte una chiave camelCase/snake_case in etichetta leggibile.
 */
function keyToLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Formatta un valore del payload in stringa visualizzabile.
 */
function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sì' : 'No';
  if (typeof value === 'string') {
    // Tenta parsing come data ISO
    const d = new Date(value);
    if (!isNaN(d.getTime()) && value.length >= 10) {
      return d.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    }
    return value;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestDetailProps {
  request: RequestRow;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestDetail({ request }: RequestDetailProps) {
  const isApplied = request.status === 'applied';
  const isResolved =
    request.status === 'approved' || request.status === 'rejected' || request.status === 'applied';

  const employeeName =
    request.userFirstName || request.userLastName
      ? `${request.userFirstName ?? ''} ${request.userLastName ?? ''}`.trim()
      : null;

  const payloadEntries = request.payload
    ? Object.entries(request.payload).filter(
        ([k]) => !['targetUserId', 'requestId'].includes(k) // nascondi campi tecnici interni
      )
    : [];

  return (
    <article
      data-testid="request-detail"
      className="border-border space-y-6 rounded-lg border bg-white p-6"
      aria-label={`Dettaglio richiesta — ${REQUEST_TYPE_LABELS[request.type] ?? request.type}`}
    >
      {/* Banner "Richiesta applicata" */}
      {isApplied && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-4 py-3"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
          <p className="text-sm font-medium text-teal-800">
            Richiesta applicata — nessuna azione disponibile (RB-16)
          </p>
        </div>
      )}

      {/* Header: tipo + stato */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {REQUEST_TYPE_LABELS[request.type] ?? request.type}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-gray-400">ID: {request.id}</p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      {/* Dati principali — dl semantico */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Richiedente */}
        <div className="flex gap-3">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div>
            <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              Richiedente
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {employeeName ?? <span className="text-gray-400 italic">Sconosciuto</span>}
            </dd>
          </div>
        </div>

        {/* Data invio */}
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div>
            <dt className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              Inviata il
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDateTime(request.submittedAt)}</dd>
          </div>
        </div>
      </dl>

      {/* Payload richiesta */}
      {payloadEntries.length > 0 && (
        <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-700">Dettagli richiesta</p>
          </div>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {payloadEntries.map(([key, value]) => (
              <div key={key} className="flex flex-col">
                <dt className="text-xs font-medium text-gray-500">{keyToLabel(key)}</dt>
                <dd className="mt-0.5 text-sm text-gray-800">{formatPayloadValue(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Risoluzione (se approvata / rifiutata) */}
      {isResolved && request.resolvedAt && (
        <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-700">Risoluzione</p>
          </div>
          <dl className="space-y-1">
            <div>
              <dt className="sr-only">Data risoluzione</dt>
              <dd className="text-xs text-gray-500">{formatDateTime(request.resolvedAt)}</dd>
            </div>
            {request.resolvedNotes && (
              <div>
                <dt className="mt-2 text-xs font-medium text-gray-500">Motivazione</dt>
                <dd className="mt-0.5 text-sm whitespace-pre-line text-gray-800">
                  {request.resolvedNotes}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </article>
  );
}
