'use client';

/**
 * components/requests/RequestQueue.tsx — Tabella coda richieste (TanStack Table v8).
 *
 * Colonne:
 *   - Dipendente (lastName firstName)
 *   - Tipo richiesta
 *   - Data invio (submittedAt)
 *   - Stato (RequestStatusBadge)
 *   - Azioni (link a /requests/[id])
 *
 * Integra TanStack Query per il fetch della lista.
 * Supporta filtri via RequestQueueFilters.
 * Ogni riga è navigabile via Link a /requests/[id].
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="table" semantico
 *   - aria-sort su colonne ordinabili
 *   - Caption visivamente nascosta (sr-only) con descrizione contenuto
 *   - Skeleton accessibile con aria-busy
 *
 * data-testid: request-queue
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';

import {
  useRequests,
  type RequestRow,
  type RequestStatus,
  type RequestType,
} from '@/hooks/useRequests';
import { RequestStatusBadge } from './RequestStatusBadge';
import { RequestQueueFilters } from './RequestQueueFilters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestQueue() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('sent');
  const [typeFilter, setTypeFilter] = useState<RequestType | 'all'>('all');

  const {
    data: response,
    isLoading,
    isError,
    error,
  } = useRequests({
    status: statusFilter,
    type: typeFilter,
  });

  const rows = response?.data ?? [];
  const total = response?.total ?? rows.length;

  // ---------------------------------------------------------------------------
  // Colonne TanStack Table
  // ---------------------------------------------------------------------------
  const columns: ColumnDef<RequestRow>[] = [
    {
      id: 'employee',
      accessorFn: (row) =>
        [row.userLastName, row.userFirstName].filter(Boolean).join(' ') || row.userId,
      header: ({ column }) => (
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-600 uppercase hover:text-gray-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Dipendente
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      ),
      cell: ({ row }) => {
        const name =
          row.original.userFirstName || row.original.userLastName
            ? `${row.original.userLastName ?? ''} ${row.original.userFirstName ?? ''}`.trim()
            : null;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">
              {name ?? <span className="text-gray-400 italic">Dipendente sconosciuto</span>}
            </span>
          </div>
        );
      },
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: () => (
        <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Tipo</span>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {REQUEST_TYPE_LABELS[row.original.type] ?? row.original.type}
        </span>
      ),
    },
    {
      id: 'submittedAt',
      accessorFn: (row) => row.submittedAt ?? '',
      header: ({ column }) => (
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold tracking-wide text-gray-600 uppercase hover:text-gray-900"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Data invio
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      ),
      cell: ({ row }) => {
        const date = formatDate(row.original.submittedAt);
        const time = formatTime(row.original.submittedAt);
        return (
          <div className="flex flex-col">
            <span className="text-sm text-gray-700">{date}</span>
            {time && <span className="text-xs text-gray-400">{time}</span>}
          </div>
        );
      },
      sortingFn: 'datetime',
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => (
        <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">Stato</span>
      ),
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Azioni</span>,
      cell: ({ row }) => (
        <Link
          href={`/admin/requests/${row.original.id}`}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
          aria-label={`Apri dettaglio richiesta di ${row.getValue<string>('employee') || row.original.userId}`}
        >
          Dettaglio
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      ),
      enableSorting: false,
    },
  ];

  // ---------------------------------------------------------------------------
  // Table instance
  // ---------------------------------------------------------------------------
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-4">
        <RequestQueueFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
        />
        <div
          className="border-border overflow-hidden rounded-lg border"
          aria-busy="true"
          aria-label="Caricamento richieste in corso"
        >
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-border flex gap-4 border-b px-4 py-3 last:border-0">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (isError) {
    return (
      <div className="space-y-4">
        <RequestQueueFilters
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
        />
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Errore nel caricamento delle richieste:{' '}
            {error instanceof Error ? error.message : 'Errore sconosciuto'}
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4" data-testid="request-queue">
      <RequestQueueFilters
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
        totalCount={total}
      />

      {table.getRowModel().rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 px-8 py-12 text-center">
          <p className="text-sm text-gray-500">
            Nessuna richiesta trovata per i filtri selezionati.
          </p>
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-lg border shadow-sm">
          <table
            className="w-full border-collapse bg-white"
            role="table"
            aria-label="Coda richieste dipendenti"
          >
            <caption className="sr-only">Elenco richieste — {total} righe totali</caption>

            <thead className="border-border border-b bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} role="row">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      role="columnheader"
                      scope="col"
                      className="px-4 py-3 text-left"
                      aria-sort={
                        header.column.getCanSort()
                          ? header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  role="row"
                  className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} role="cell" className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
