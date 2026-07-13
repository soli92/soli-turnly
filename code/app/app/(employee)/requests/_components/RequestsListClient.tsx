'use client';

/**
 * app/(employee)/requests/_components/RequestsListClient.tsx
 *
 * Client component che mostra la lista richieste del dipendente.
 * Usa TanStack Query per fetch + auto-refresh.
 */

import { useRequests, type RequestRow } from '@/hooks/useRequests';

const TYPE_LABELS: Record<RequestRow['type'], string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

const STATUS_STYLES: Record<
  RequestRow['status'],
  { label: string; className: string }
> = {
  pending: {
    label: 'In attesa',
    className: 'bg-yellow-100 text-yellow-800',
  },
  approved: {
    label: 'Approvata',
    className: 'bg-green-100 text-green-800',
  },
  rejected: {
    label: 'Rifiutata',
    className: 'bg-red-100 text-red-800',
  },
  cancelled: {
    label: 'Annullata',
    className: 'bg-gray-100 text-gray-600',
  },
};

export function RequestsListClient() {
  const { data: requests, isLoading, isError, error } = useRequests();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento richieste">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg border border-border bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento richieste:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">Nessuna richiesta trovata</p>
        <p className="text-xs text-gray-400 mt-1">
          Clicca su &quot;Nuova richiesta&quot; per iniziare
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label="Lista richieste">
      {requests.map((request) => {
        const statusInfo = STATUS_STYLES[request.status];
        return (
          <div
            key={request.id}
            role="listitem"
            className="flex items-center justify-between rounded-lg border border-border bg-white p-4"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-gray-900">
                {TYPE_LABELS[request.type]}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(request.createdAt).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
