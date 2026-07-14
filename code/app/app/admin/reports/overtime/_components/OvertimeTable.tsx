'use client';

/**
 * OvertimeTable.tsx — Tabella ore straordinarie (TSK-027).
 *
 * Usa TanStack Table v8 con ordinamento client-side.
 * Ordinamento di default: overtimeHours decrescente (AC: dipendente con più
 * straordinario in cima).
 *
 * Colonne:
 *   Dipendente | Qualifica | Ore contratto | Ore ordinarie | Ore straordinarie | Totale | Soglia
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label sulla tabella
 *   - scope="col" sulle intestazioni
 *   - pulsanti di ordinamento con aria-label
 *   - OvertimeRowBadge con aria-label esplicito
 *
 * Layout: overflow-x-auto per scroll orizzontale su mobile (375px, AC).
 *
 * RF-I.
 */

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

import { OvertimeRowBadge } from './OvertimeRowBadge';
import type { OvertimeReportRow } from '@/hooks/useOvertimeReport';

// ---------------------------------------------------------------------------
// Helper: icona di ordinamento
// ---------------------------------------------------------------------------

type SortDir = false | 'asc' | 'desc';

function SortIcon({ dir, label }: { dir: SortDir; label: string }) {
  if (dir === 'asc')
    return (
      <ArrowUp className="text-primary h-3 w-3" aria-label={`Ordinato per ${label} crescente`} />
    );
  if (dir === 'desc')
    return (
      <ArrowDown
        className="text-primary h-3 w-3"
        aria-label={`Ordinato per ${label} decrescente`}
      />
    );
  return <ArrowUpDown className="h-3 w-3 opacity-40" aria-label={`Ordina per ${label}`} />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OvertimeTableProps {
  rows: OvertimeReportRow[];
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function OvertimeTable({ rows }: OvertimeTableProps) {
  // Ordinamento di default: overtimeHours desc (AC)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'overtimeHours', desc: true }]);

  const columns = useMemo<ColumnDef<OvertimeReportRow>[]>(
    () => [
      {
        id: 'name',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
            aria-label={`Ordina per dipendente ${column.getIsSorted() === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            Dipendente
            <SortIcon dir={column.getIsSorted()} label="dipendente" />
          </button>
        ),
        accessorFn: (row) => `${row.lastName} ${row.firstName}`,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">
            {row.original.lastName} {row.original.firstName}
          </span>
        ),
        sortingFn: 'alphanumeric',
      },
      {
        id: 'qualificationName',
        header: 'Qualifica',
        accessorKey: 'qualificationName',
        cell: ({ row }) =>
          row.original.qualificationName ? (
            <span className="text-gray-700">{row.original.qualificationName}</span>
          ) : (
            <span className="text-gray-400 italic">—</span>
          ),
        enableSorting: false,
      },
      {
        id: 'contractHours',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
            aria-label={`Ordina per ore contratto ${column.getIsSorted() === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            Ore contratto
            <SortIcon dir={column.getIsSorted()} label="ore contratto" />
          </button>
        ),
        accessorKey: 'contractHours',
        cell: ({ row }) => (
          <span className="text-gray-700 tabular-nums">{row.original.contractHours}h/sett</span>
        ),
      },
      {
        id: 'ordinaryHours',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
            aria-label={`Ordina per ore ordinarie ${column.getIsSorted() === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            Ore ordinarie
            <SortIcon dir={column.getIsSorted()} label="ore ordinarie" />
          </button>
        ),
        accessorKey: 'ordinaryHours',
        cell: ({ row }) => (
          <span className="text-gray-700 tabular-nums">
            {row.original.ordinaryHours.toFixed(2)}
          </span>
        ),
      },
      {
        id: 'overtimeHours',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
            aria-label={`Ordina per ore straordinarie ${column.getIsSorted() === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            Ore straord.
            <SortIcon dir={column.getIsSorted()} label="ore straordinarie" />
          </button>
        ),
        accessorKey: 'overtimeHours',
        cell: ({ row }) => {
          const { overtimeHours, overtimeExceedsThreshold } = row.original;
          return (
            <div className="flex items-center gap-2">
              <span
                className={[
                  'font-semibold tabular-nums',
                  overtimeHours > 0 ? 'text-amber-700' : 'text-gray-400',
                ].join(' ')}
              >
                {overtimeHours.toFixed(2)}
              </span>
              <OvertimeRowBadge
                exceedsThreshold={overtimeExceedsThreshold}
                overtimeHours={overtimeHours}
              />
            </div>
          );
        },
      },
      {
        id: 'totalHours',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
            aria-label={`Ordina per ore totali ${column.getIsSorted() === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            Totale ore
            <SortIcon dir={column.getIsSorted()} label="totale ore" />
          </button>
        ),
        accessorKey: 'totalHours',
        cell: ({ row }) => (
          <span className="font-bold text-gray-900 tabular-nums">
            {row.original.totalHours.toFixed(2)}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
        <p className="text-sm font-medium text-gray-700">Nessun dato nel periodo</p>
        <p className="mt-1 text-xs text-gray-500">
          Non ci sono turni pianificati o confermati nel periodo selezionato.
        </p>
      </div>
    );
  }

  return (
    /* overflow-x-auto per scroll orizzontale su mobile 375px (AC) */
    <div className="border-border overflow-x-auto rounded-lg border">
      <table
        className="w-full min-w-[640px] text-sm"
        aria-label="Report ore straordinarie per dipendente"
      >
        <thead className="border-border border-b bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  className="px-4 py-3 text-left font-medium text-gray-700"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-border divide-y bg-white">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={[
                'transition-colors hover:bg-gray-50',
                row.original.overtimeExceedsThreshold ? 'bg-red-50/40' : '',
              ].join(' ')}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
