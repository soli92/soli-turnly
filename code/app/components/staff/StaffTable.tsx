'use client';

/**
 * components/staff/StaffTable.tsx — Tabella anagrafica dipendenti.
 *
 * TanStack Table v8 + @tanstack/react-virtual (virtualizzazione righe).
 *
 * Colonne (ordine RF-B):
 *   cognome | nome | email | qualifica | ore/sett. | contratto | stato | azioni
 *
 * Funzionalità:
 *   - Sort click su header colonne
 *   - Virtualizzazione righe (50+ dipendenti senza blocco UI)
 *   - Empty state con messaggio appropriato
 *   - Azioni inline: Modifica
 *
 * Nota: la colonna "contratto" mostra Full-time (≥36h) / Part-time (<36h)
 * derivato da contractHours. Il campo contractType non è ancora supportato
 * dall'API (gap G-004 in wiki/gaps.md).
 *
 * Accessibility: WCAG 2.2 AA
 *   - role="grid" + aria-rowcount/aria-colcount
 *   - aria-sort su header colonne ordinabili
 *   - aria-colindex / aria-rowindex
 *   - Bottoni con aria-label contestuale
 */

import { useRef, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { StaffStatusBadge } from './StaffStatusBadge';
import type { StaffRow } from '@/hooks/useStaff';
import type { QualificationOption } from './StaffSearchFilters';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface StaffTableProps {
  rows: StaffRow[];
  qualifications: QualificationOption[];
  onEdit: (staff: StaffRow) => void;
}

// ---------------------------------------------------------------------------
// Helper: deriva il tipo contratto da contractHours
// ---------------------------------------------------------------------------

function deriveContractType(contractHours: number): string {
  if (contractHours >= 36) return 'Full-time';
  if (contractHours > 0) return 'Part-time';
  return '—';
}

// ---------------------------------------------------------------------------
// Costanti layout
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 52; // px

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StaffTable({ rows, qualifications, onEdit }: StaffTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastName', desc: false }]);

  // Mappa qualificationId → name per lookup O(1)
  const qualMap = useMemo(
    () => new Map(qualifications.map((q) => [q.id, q.name])),
    [qualifications]
  );

  // Risolve qualificationName: preferisce il valore dal server, poi il lookup client-side
  function resolveQualName(row: StaffRow): string {
    if (row.qualificationName) return row.qualificationName;
    if (row.qualificationId) return qualMap.get(row.qualificationId) ?? '—';
    return '—';
  }

  // -----------------------------------------------------------------------
  // Definizione colonne
  // -----------------------------------------------------------------------

  const columns = useMemo<ColumnDef<StaffRow>[]>(
    () => [
      {
        id: 'lastName',
        accessorKey: 'lastName',
        header: ({ column }) => (
          <SortableHeader
            label="Cognome"
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => (
          <span className="font-medium text-gray-900">{getValue<string>()}</span>
        ),
        size: 140,
      },
      {
        id: 'firstName',
        accessorKey: 'firstName',
        header: ({ column }) => (
          <SortableHeader
            label="Nome"
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => <span className="text-gray-900">{getValue<string>()}</span>,
        size: 130,
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: ({ column }) => (
          <SortableHeader
            label="Email"
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue<string>()}</span>,
        size: 220,
      },
      {
        id: 'qualifica',
        accessorFn: (row) => resolveQualName(row),
        header: ({ column }) => (
          <SortableHeader
            label="Qualifica"
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue<string>()}</span>,
        size: 140,
      },
      {
        id: 'contractHours',
        accessorKey: 'contractHours',
        header: ({ column }) => (
          <SortableHeader
            label="Ore/sett."
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600 tabular-nums">{getValue<number>()}h</span>
        ),
        size: 90,
      },
      {
        id: 'contratto',
        accessorFn: (row) => deriveContractType(row.contractHours),
        header: () => (
          <span className="px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
            Contratto
          </span>
        ),
        cell: ({ getValue }) => <span className="text-sm text-gray-600">{getValue<string>()}</span>,
        size: 100,
        enableSorting: false,
      },
      {
        id: 'active',
        accessorKey: 'active',
        header: ({ column }) => (
          <SortableHeader
            label="Stato"
            isSorted={column.getIsSorted()}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          />
        ),
        cell: ({ getValue }) => <StaffStatusBadge active={getValue<boolean>()} />,
        size: 90,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Azioni</span>,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(row.original)}
            aria-label={`Modifica ${row.original.firstName} ${row.original.lastName}`}
            data-testid={`staff-edit-btn-${row.original.id}`}
          >
            <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Modifica
          </Button>
        ),
        size: 100,
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qualMap, onEdit]
  );

  // -----------------------------------------------------------------------
  // TanStack Table
  // -----------------------------------------------------------------------

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  // -----------------------------------------------------------------------
  // TanStack Virtual
  // -----------------------------------------------------------------------

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  const totalWidth = columns.reduce((sum, col) => sum + (col.size ?? 100), 0);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto rounded-lg border border-gray-200 shadow-sm"
      style={{ maxHeight: 'calc(100vh - 280px)' }}
      data-testid="staff-table-container"
    >
      <table
        className="border-collapse"
        style={{ width: `${totalWidth}px`, tableLayout: 'fixed', minWidth: '100%' }}
        role="grid"
        aria-label="Anagrafica dipendenti"
        aria-rowcount={tableRows.length + 1}
        aria-colcount={columns.length}
      >
        {/* Header sticky */}
        <thead
          className="sticky top-0 z-10 bg-white"
          style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} role="row">
              {headerGroup.headers.map((header, colIdx) => {
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    role="columnheader"
                    aria-colindex={colIdx + 1}
                    aria-sort={
                      sortDir === 'asc'
                        ? 'ascending'
                        : sortDir === 'desc'
                          ? 'descending'
                          : header.column.getCanSort()
                            ? 'none'
                            : undefined
                    }
                    className="border-b border-gray-200 bg-gray-50 text-left"
                    style={{ width: header.getSize(), minWidth: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        {/* Body virtualizzato */}
        <tbody
          style={{
            height: `${totalHeight}px`,
            position: 'relative',
            display: 'block',
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = tableRows[virtualRow.index];
            if (!row) return null;

            return (
              <tr
                key={row.id}
                role="row"
                aria-rowindex={virtualRow.index + 2}
                className="transition-colors hover:bg-blue-50/40"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                }}
              >
                {row.getVisibleCells().map((cell, colIdx) => (
                  <td
                    key={cell.id}
                    role="gridcell"
                    aria-colindex={colIdx + 1}
                    className="flex flex-shrink-0 items-center overflow-hidden border-b border-gray-100 bg-white px-3"
                    style={{
                      width: cell.column.getSize(),
                      minWidth: cell.column.getSize(),
                      height: `${virtualRow.size}px`,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Empty state */}
      {tableRows.length === 0 && (
        <div
          className="flex h-32 items-center justify-center text-sm text-gray-500"
          role="status"
          aria-live="polite"
          data-testid="staff-empty-state"
        >
          Nessun dipendente trovato con i filtri selezionati.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableHeader — header colonna con indicatore di ordinamento
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  label: string;
  isSorted: false | 'asc' | 'desc';
  onClick: () => void;
}

function SortableHeader({ label, isSorted, onClick }: SortableHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:ring-ring flex w-full items-center gap-1 px-3 py-2 text-xs font-semibold tracking-wide text-gray-600 uppercase hover:text-gray-900 focus:outline-none focus-visible:ring-2"
    >
      {label}
      {isSorted === 'asc' ? (
        <ArrowUp className="h-3 w-3 text-blue-600" aria-hidden="true" />
      ) : isSorted === 'desc' ? (
        <ArrowDown className="h-3 w-3 text-blue-600" aria-hidden="true" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-gray-400" aria-hidden="true" />
      )}
    </button>
  );
}
