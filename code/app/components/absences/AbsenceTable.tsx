'use client';

/**
 * components/absences/AbsenceTable.tsx — Tabella assenze admin (TSK-017).
 *
 * Colonne: dipendente, tipo, periodo (startDate–endDate), stato, azioni.
 * Filtri lato client: per dipendente (Select) + periodo (date range).
 * Azioni: Elimina (AlertDialog di conferma).
 *
 * Gestione stati:
 *   - Skeleton durante il fetch
 *   - Empty state con messaggio contestuale
 *   - Errore con alert
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label sulla tabella
 *   - scope="col" sulle intestazioni
 *   - aria-busy durante il loading
 *   - AlertDialog con focus su "Annulla" (Radix default)
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { AbsenceTypeBadge } from './AbsenceTypeBadge';
import { useAbsences, useDeleteAbsence, type AbsenceRow } from '@/hooks/useAbsences';
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Stato badge assenza
// ---------------------------------------------------------------------------

function AbsenceStatusBadge({ status }: { status: AbsenceRow['status'] }) {
  const map: Record<AbsenceRow['status'], { label: string; className: string }> = {
    pending: { label: 'In attesa', className: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approvata', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'Rifiutata', className: 'bg-red-100 text-red-800' },
  };
  const cfg = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbsenceTableProps {
  /** Lista utenti per il filtro dipendente */
  users: Pick<UserRow, 'id' | 'firstName' | 'lastName'>[];
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export function AbsenceTable({ users }: AbsenceTableProps) {
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterTo, setFilterTo] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<AbsenceRow | null>(null);

  const {
    data: absences,
    isLoading,
    isError,
    error,
  } = useAbsences({
    userId: filterUserId || undefined,
    from: filterFrom || undefined,
    to: filterTo || undefined,
  });

  const deleteMutation = useDeleteAbsence();

  // ---------------------------------------------------------------------------
  // Stati caricamento / errore
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Caricamento assenze">
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
  // Helper: nome dipendente da userId
  // ---------------------------------------------------------------------------

  function getUserName(userId: string): string {
    const user = users.find((u) => u.id === userId);
    if (!user) return userId;
    return `${user.firstName} ${user.lastName}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasFilters = Boolean(filterUserId || filterFrom || filterTo);

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div
        className="flex flex-wrap items-end gap-3"
        role="group"
        aria-label="Filtri lista assenze"
      >
        {/* Filtro dipendente */}
        <div className="max-w-xs min-w-[180px] flex-1 space-y-1">
          <label htmlFor="filter-user" className="text-xs font-medium text-gray-600">
            Dipendente
          </label>
          <Select
            value={filterUserId || '__all__'}
            onValueChange={(v) => setFilterUserId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger id="filter-user" aria-label="Filtra per dipendente">
              <SelectValue placeholder="Tutti i dipendenti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti i dipendenti</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro da */}
        <div className="space-y-1">
          <label htmlFor="filter-from" className="text-xs font-medium text-gray-600">
            Dal
          </label>
          <Input
            id="filter-from"
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-36"
            aria-label="Filtra dal giorno"
          />
        </div>

        {/* Filtro al */}
        <div className="space-y-1">
          <label htmlFor="filter-to" className="text-xs font-medium text-gray-600">
            Al
          </label>
          <Input
            id="filter-to"
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-36"
            aria-label="Filtra al giorno"
          />
        </div>

        {/* Reset filtri */}
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilterUserId('');
              setFilterFrom('');
              setFilterTo('');
            }}
            aria-label="Rimuovi tutti i filtri"
          >
            Rimuovi filtri
          </Button>
        )}
      </div>

      {/* Empty state */}
      {!absences || absences.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm font-medium text-gray-700">Nessuna assenza attiva</p>
          <p className="mt-1 text-xs text-gray-500">
            {hasFilters
              ? 'Nessuna assenza corrisponde ai filtri selezionati.'
              : 'Non ci sono assenze registrate. Usa il form sopra per registrarne una.'}
          </p>
        </div>
      ) : (
        /* Tabella */
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[600px] text-sm" aria-label="Lista assenze">
            <thead className="border-border border-b bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Dipendente
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Tipo
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Periodo
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                  Stato
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-gray-700">
                  <span className="sr-only">Azioni</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y bg-white">
              {absences.map((absence) => {
                const startLabel = format(
                  new Date(absence.startDate + 'T00:00:00'),
                  'dd MMM yyyy',
                  { locale: it }
                );
                const endLabel = format(new Date(absence.endDate + 'T00:00:00'), 'dd MMM yyyy', {
                  locale: it,
                });
                const isSameDay = absence.startDate === absence.endDate;

                return (
                  <tr key={absence.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {getUserName(absence.userId)}
                    </td>
                    <td className="px-4 py-3">
                      <AbsenceTypeBadge type={absence.absenceTypeId} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 tabular-nums">
                      {isSameDay ? startLabel : `${startLabel} – ${endLabel}`}
                    </td>
                    <td className="px-4 py-3">
                      <AbsenceStatusBadge status={absence.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(absence)}
                        aria-label={`Elimina assenza di ${getUserName(absence.userId)}`}
                        className="border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Elimina
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AlertDialog conferma eliminazione */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare l&apos;assenza?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;assenza di{' '}
              <strong>{deleteTarget ? getUserName(deleteTarget.userId) : ''}</strong> verrà rimossa.
              I turni già modificati o annullati non verranno ripristinati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id, {
                  onSettled: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
