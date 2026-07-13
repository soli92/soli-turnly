'use client';

/**
 * app/(admin)/requests/_components/ApprovalQueueClient.tsx
 *
 * Lista delle richieste pending con ApprovalPanel per ciascuna.
 * Filtra per status=pending di default.
 */

import { useState } from 'react';
import { useRequests } from '@/hooks/useRequests';
import { ApprovalPanel } from '@/components/requests/ApprovalPanel';
import { Button } from '@/components/ui/button';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'In attesa' },
  { value: 'approved', label: 'Approvate' },
  { value: 'rejected', label: 'Rifiutate' },
  { value: 'all', label: 'Tutte' },
];

export function ApprovalQueueClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const { data: requests, isLoading, isError, error } = useRequests(
    statusFilter !== 'all' ? { status: statusFilter } : undefined,
  );

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Caricamento richieste">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-lg border border-border bg-gray-50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtri stato */}
      <div
        className="flex gap-2 flex-wrap"
        role="group"
        aria-label="Filtra per stato richiesta"
      >
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={statusFilter === opt.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(opt.value)}
            aria-pressed={statusFilter === opt.value}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Lista richieste */}
      {!requests || requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {statusFilter === 'pending'
              ? 'Nessuna richiesta in attesa'
              : 'Nessuna richiesta trovata per questo filtro'}
          </p>
        </div>
      ) : (
        <div
          className="space-y-4"
          role="list"
          aria-label={`${requests.length} richiesta${requests.length !== 1 ? 'e' : ''}`}
        >
          {requests.map((request) => (
            <div key={request.id} role="listitem">
              <ApprovalPanel
                requestId={request.id}
                request={request}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
