'use client';

/**
 * components/employee/requests/MyRequestList.tsx
 *
 * Lista richieste del dipendente autenticato con filtri tipo/stato.
 *
 * Funzionalità:
 *   - Carica GET /api/requests (dipendente vede solo le proprie — T-SEC-07)
 *   - Filtri: per tipo e per stato (Select shadcn)
 *   - Ordinamento default: più recenti prima (submittedAt desc)
 *   - Loading skeleton (3 placeholder card)
 *   - Empty state con invito a creare richiesta
 *   - Error state con messaggio
 *   - Aggiornamento real-time via useNotifications() — già attivo nel layout
 *
 * Nota: la sezione "Scambi ricevuti" richiede GET /api/requests?received_swap=true
 * (GAP-TSK022-002) — mostrata come sezione separata con avviso BE pending.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - aria-live="polite" sul contatore risultati
 *   - aria-busy durante fetch
 *   - role="list" sulla lista
 *
 * data-testid: my-request-list, request-type-filter, request-status-filter
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Info, PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRequests, type RequestType, type RequestStatus } from '@/hooks/useRequests';
import { MyRequestCard } from './MyRequestCard';

// ---------------------------------------------------------------------------
// Filtri disponibili
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: RequestType | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti i tipi' },
  { value: 'absence', label: 'Assenza' },
  { value: 'shift_swap', label: 'Scambio turno' },
  { value: 'new_shift', label: 'Nuovo turno' },
  { value: 'modify_shift', label: 'Modifica turno' },
];

const STATUS_OPTIONS: { value: RequestStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'draft', label: 'Bozza' },
  { value: 'sent', label: 'In attesa' },
  { value: 'awaiting_colleague', label: 'Attesa collega' },
  { value: 'approved', label: 'Approvata' },
  { value: 'rejected', label: 'Rifiutata' },
  { value: 'cancelled', label: 'Annullata' },
  { value: 'applied', label: 'Applicata' },
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function RequestListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Caricamento richieste">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="border-border overflow-hidden rounded-lg border bg-white shadow-sm"
          aria-hidden="true"
        >
          <div className="space-y-2 p-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-2.5">
            <Skeleton className="ml-auto h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export function MyRequestList() {
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');

  const requestFilters = {
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
  };

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useRequests(Object.keys(requestFilters).length > 0 ? requestFilters : undefined);

  const requests = useMemo(() => {
    const rows = response?.data ?? [];
    // Ordinamento client-side: più recenti prima (submittedAt desc)
    return [...rows].sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [response]);

  const total = response?.total ?? requests.length;

  return (
    <div className="space-y-4" data-testid="my-request-list">
      {/* Filtri */}
      <div
        className="flex flex-wrap items-end gap-3"
        role="group"
        aria-label="Filtri lista richieste"
      >
        <div className="flex min-w-[160px] flex-col gap-1">
          <label htmlFor="request-type-filter" className="text-xs font-medium text-gray-500">
            Tipo
          </label>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as RequestType | 'all')}>
            <SelectTrigger
              id="request-type-filter"
              data-testid="request-type-filter"
              className="h-8 text-sm"
              aria-label="Filtra per tipo richiesta"
            >
              <SelectValue placeholder="Tutti i tipi" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1">
          <label htmlFor="request-status-filter" className="text-xs font-medium text-gray-500">
            Stato
          </label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as RequestStatus | 'all')}
          >
            <SelectTrigger
              id="request-status-filter"
              data-testid="request-status-filter"
              className="h-8 text-sm"
              aria-label="Filtra per stato richiesta"
            >
              <SelectValue placeholder="Tutti gli stati" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contatore risultati */}
        {!isLoading && !isError && (
          <p aria-live="polite" aria-atomic="true" className="self-end pb-1 text-xs text-gray-500">
            {total === 0 ? 'Nessun risultato' : `${total} richiest${total !== 1 ? 'e' : 'a'}`}
          </p>
        )}
      </div>

      {/* Sezione "Scambi ricevuti" — GAP-TSK022-002 */}
      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <p className="text-xs text-gray-500">
          <span className="font-medium">Scambi turno ricevuti da colleghi:</span> disponibile non
          appena il backend implementa{' '}
          <code className="rounded bg-gray-200 px-1 text-xs">
            GET /api/requests?received_swap=true
          </code>{' '}
          (GAP-TSK022-002). Per ora, gli scambi ricevuti sono visibili nella sezione notifiche.
        </p>
      </div>

      {/* Lista */}
      {isLoading && <RequestListSkeleton />}

      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Errore nel caricamento richieste:{' '}
            {error instanceof Error ? error.message : 'Errore sconosciuto'}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
            Riprova
          </Button>
        </div>
      )}

      {!isLoading && !isError && requests.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm font-medium text-gray-500">
            {typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Nessuna richiesta trovata per i filtri selezionati'
              : 'Non hai ancora inviato richieste'}
          </p>
          {typeFilter === 'all' && statusFilter === 'all' && (
            <p className="mt-1 text-xs text-gray-400">
              Crea la tua prima richiesta cliccando &quot;Nuova richiesta&quot;
            </p>
          )}
          {(typeFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setTypeFilter('all');
                setStatusFilter('all');
              }}
            >
              Rimuovi filtri
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && requests.length > 0 && (
        <div role="list" aria-label={`${total} richieste`} className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} role="listitem">
              <MyRequestCard request={request} onCancelled={() => void refetch()} />
            </div>
          ))}
        </div>
      )}

      {/* CTA nuova richiesta se lista non vuota */}
      {!isLoading && !isError && requests.length > 0 && (
        <div className="flex justify-center pt-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/requests/new">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Nuova richiesta
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
