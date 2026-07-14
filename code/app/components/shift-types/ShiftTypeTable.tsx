'use client';

/**
 * components/shift-types/ShiftTypeTable.tsx — Tabella TanStack Table tipologie turno.
 *
 * Colonne: nome (ShiftTypeBadge), orari, durata, pausa, stato, azioni.
 * Azioni:
 *   - Modifica → apre ShiftTypeModal in modalità edit
 *   - Disattiva (inUse=true) → AlertDialog PATCH {active: false}
 *   - Elimina (inUse=false)  → AlertDialog DELETE
 *
 * Gestione stato:
 *   - Skeleton durante il fetch
 *   - Empty state se nessuna tipologia
 *   - Errore con alert
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label sulla tabella
 *   - scope="col" sulle intestazioni
 *   - aria-busy durante il loading
 *   - AlertDialog con focus su "Annulla" per default (pattern Radix)
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
import { ArrowUpDown, Pencil, Trash2, PowerOff, Plus } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ShiftTypeBadge } from './ShiftTypeBadge';
import { ShiftTypeModal } from './ShiftTypeModal';
import {
  useShiftTypes,
  useDeactivateShiftType,
  useDeleteShiftType,
  type ShiftTypeFullRow,
} from '@/hooks/useShiftTypes';

// ---------------------------------------------------------------------------
// Utility: parsing sicuro HH:MM → { h, m } | null
// ---------------------------------------------------------------------------

function parseHHMM(time: string): { h: number; m: number } | null {
  if (!/^\d{2}:\d{2}/.test(time)) return null;
  const colonIdx = time.indexOf(':');
  const h = parseInt(time.slice(0, colonIdx), 10);
  const m = parseInt(time.slice(colonIdx + 1), 10);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
}

function calcDurationMinutes(startTime: string, endTime: string): number | null {
  const start = parseHHMM(startTime);
  const end = parseHHMM(endTime);
  if (!start || !end) return null;

  const ref = new Date(2000, 0, 3, 0, 0, 0);
  const startDt = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), start.h, start.m);
  const endSameDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), end.h, end.m);

  const crossesMidnight = end.h * 60 + end.m <= start.h * 60 + start.m;
  const endDt = crossesMidnight ? new Date(endSameDay.getTime() + 24 * 60 * 60 * 1000) : endSameDay;

  return differenceInMinutes(endDt, startDt);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// ---------------------------------------------------------------------------
// Stato azioni (quale riga è in corso di delete/deactivate)
// ---------------------------------------------------------------------------

interface ActionState {
  type: 'delete' | 'deactivate';
  shiftType: ShiftTypeFullRow;
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export interface ShiftTypeTableProps {
  /**
   * Mappa id → inUse: se true la tipologia ha turni associati e può solo essere
   * disattivata (PATCH), non eliminata (DELETE).
   * Default: tutte inUse=false (nessun turno associato noto).
   */
  inUseMap?: Record<string, boolean>;
  /** Callback per aggiungere una nuova tipologia (apre il modal create). */
  onAddNew?: () => void;
}

export function ShiftTypeTable({ inUseMap = {}, onAddNew }: ShiftTypeTableProps) {
  const { data: shiftTypes, isLoading, isError, error } = useShiftTypes();

  const deactivateMutation = useDeactivateShiftType();
  const deleteMutation = useDeleteShiftType();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [editTarget, setEditTarget] = useState<ShiftTypeFullRow | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);

  // Definizione colonne TanStack Table
  const columns = useMemo<ColumnDef<ShiftTypeFullRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 text-left font-medium text-gray-700 hover:text-gray-900"
          >
            Nome
            <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
          </button>
        ),
        cell: ({ row }) => (
          <ShiftTypeBadge
            name={row.original.name}
            code={row.original.code}
            color={row.original.color}
            active={row.original.active}
          />
        ),
      },
      {
        id: 'orari',
        header: 'Orari',
        cell: ({ row }) => {
          const startRaw = row.original.defaultStartTime;
          const endRaw = row.original.defaultEndTime;
          const start = parseHHMM(startRaw);
          const end = parseHHMM(endRaw);
          const startStr = startRaw.slice(0, 5);
          const endStr = endRaw.slice(0, 5);
          const crossesMidnight =
            start && end ? end.h * 60 + end.m <= start.h * 60 + start.m : false;
          return (
            <span className="text-gray-700 tabular-nums">
              {startStr} – {endStr}
              {crossesMidnight && (
                <span
                  className="ml-1 text-xs text-amber-600"
                  aria-label="turno notturno, fine giorno successivo"
                >
                  +1g
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: 'durata',
        header: 'Durata',
        cell: ({ row }) => {
          const minutes = calcDurationMinutes(
            row.original.defaultStartTime,
            row.original.defaultEndTime
          );
          return minutes !== null ? (
            <span className="text-gray-700 tabular-nums">{formatDuration(minutes)}</span>
          ) : (
            <span className="text-gray-400">—</span>
          );
        },
      },
      {
        id: 'pausa',
        accessorKey: 'breakMinutes',
        header: 'Pausa',
        cell: ({ row }) => (
          <span className="text-gray-600 tabular-nums">
            {row.original.breakMinutes > 0 ? `${row.original.breakMinutes} min` : '—'}
          </span>
        ),
      },
      {
        id: 'stato',
        header: 'Stato',
        cell: ({ row }) => {
          const isInUse = inUseMap[row.original.id] ?? false;
          return (
            <div className="flex flex-wrap gap-1">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.original.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {row.original.active ? 'Attiva' : 'Inattiva'}
              </span>
              {isInUse && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  In uso
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'azioni',
        header: () => <span className="sr-only">Azioni</span>,
        cell: ({ row }) => {
          const st = row.original;
          const isInUse = inUseMap[st.id] ?? false;
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditTarget(st)}
                aria-label={`Modifica ${st.name}`}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                Modifica
              </Button>
              {isInUse ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionState({ type: 'deactivate', shiftType: st })}
                  aria-label={`Disattiva ${st.name}`}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  <PowerOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Disattiva
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionState({ type: 'delete', shiftType: st })}
                  aria-label={`Elimina ${st.name}`}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  Elimina
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [inUseMap]
  );

  const table = useReactTable({
    data: shiftTypes ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // ---------------------------------------------------------------------------
  // Stati di caricamento / errore
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Caricamento tipologie turno">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-border h-12 animate-pulse rounded-lg border bg-gray-50" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento: {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!shiftTypes || shiftTypes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
        <p className="text-sm font-medium text-gray-700">Nessuna tipologia di turno</p>
        <p className="mt-1 text-xs text-gray-500">
          Crea la prima tipologia per iniziare a pianificare i turni.
        </p>
        {onAddNew && (
          <Button className="mt-4" size="sm" onClick={onAddNew}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nuova tipologia
          </Button>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tabella
  // ---------------------------------------------------------------------------

  const isPending = deactivateMutation.isPending || deleteMutation.isPending;

  return (
    <>
      {/* Tabella TanStack */}
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm" aria-label="Tipologie di turno">
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
              <tr key={row.id} className="transition-colors hover:bg-gray-50">
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

      {/* Modal modifica */}
      {editTarget && (
        <ShiftTypeModal
          mode="edit"
          open={editTarget !== null}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          shiftType={editTarget}
        />
      )}

      {/* AlertDialog disattiva (inUse=true) */}
      <AlertDialog
        open={actionState?.type === 'deactivate'}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disattiva &quot;{actionState?.shiftType.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Questa tipologia è associata a turni esistenti. Non verrà eliminata ma marcata come{' '}
              <strong>inattiva</strong>: non sarà selezionabile per nuovi turni. I turni già
              pianificati non vengono modificati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                if (!actionState) return;
                deactivateMutation.mutate(actionState.shiftType.id, {
                  onSettled: () => setActionState(null),
                });
              }}
            >
              {deactivateMutation.isPending ? 'Disattivazione...' : 'Disattiva'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog elimina (inUse=false) */}
      <AlertDialog
        open={actionState?.type === 'delete'}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminare &quot;{actionState?.shiftType.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La tipologia verrà disattivata e non sarà più selezionabile per nuovi turni. Questa
              operazione può essere annullata riattivando la tipologia tramite &quot;Modifica&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (!actionState) return;
                deleteMutation.mutate(actionState.shiftType.id, {
                  onSettled: () => setActionState(null),
                });
              }}
            >
              {deleteMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
