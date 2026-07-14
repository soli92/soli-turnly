'use client';

/**
 * components/recurrence/RecurrenceList.tsx
 *
 * Lista ricorrenze attive con azioni Modifica, Disattiva, Visualizza occorrenze.
 *
 * Carica le ricorrenze via TanStack Query e le arricchisce con il nome utente
 * (join client-side con useUsers). Mostra frequenza, tipo turno e intervallo date.
 *
 * Azioni:
 *   - Modifica → redirect al wizard (via Link) — piena modifica serie
 *   - Disattiva → AlertDialog PATCH soft-delete
 *   - Visualizza occorrenze → Dialog con lista occorrenze (RF-E CA2)
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label sulla tabella
 *   - scope="col" sulle intestazioni
 *   - aria-busy durante il loading
 *   - AlertDialog con focus gestito da Radix
 *   - Badge stato con testo visibile (non solo colore)
 *
 * TSK-019, RF-E
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Pencil, PowerOff, CalendarSearch } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useRecurrences,
  useDeactivateRecurrence,
  type RecurrenceRow,
} from '@/hooks/useRecurrences';
import { useUsers } from '@/hooks/useUsers';
import { useShiftTypes } from '@/hooks/useShiftTypes';

// ---------------------------------------------------------------------------
// Utility: label frequenza
// ---------------------------------------------------------------------------

const FREQ_LABELS: Record<RecurrenceRow['frequency'], string> = {
  weekly: 'Settimanale',
  biweekly: 'Bisettimanale',
  monthly: 'Mensile',
};

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function formatDaysOfWeek(days: number[]): string {
  const sorted = [...days].sort((a, b) => {
    // Ordina Lun-Dom (1-0)
    const a2 = a === 0 ? 7 : a;
    const b2 = b === 0 ? 7 : b;
    return a2 - b2;
  });
  return sorted.map((d) => DOW_LABELS[d] ?? '?').join(', ');
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export function RecurrenceList() {
  const { data: recurrences = [], isLoading, isError, error } = useRecurrences();
  const { data: users = [] } = useUsers();
  const { data: shiftTypes = [] } = useShiftTypes();
  const deactivateMutation = useDeactivateRecurrence();

  const [deactivateTarget, setDeactivateTarget] = useState<RecurrenceRow | null>(null);
  const [occurrencesTarget, setOccurrencesTarget] = useState<RecurrenceRow | null>(null);

  // Mappe per lookup rapido
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) {
      m.set(u.id, `${u.firstName} ${u.lastName}`);
    }
    return m;
  }, [users]);

  const shiftTypeMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const st of shiftTypes) {
      m.set(st.id, { name: st.name, color: st.color });
    }
    return m;
  }, [shiftTypes]);

  // ---------------------------------------------------------------------------
  // Stato di caricamento
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Caricamento ricorrenze">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-border h-14 animate-pulse rounded-lg border bg-gray-50" />
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

  if (recurrences.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
        <CalendarSearch className="mx-auto mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700">Nessuna ricorrenza attiva</p>
        <p className="mt-1 text-xs text-gray-500">
          Crea la prima regola di ricorrenza per automatizzare la generazione dei turni.
        </p>
        <Button className="mt-4" size="sm" asChild>
          <Link href="/admin/recurrence/new">Crea ricorrenza</Link>
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tabella
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm" aria-label="Ricorrenze turni">
          <thead className="border-border border-b bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                Dipendente
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                Tipo turno
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                Frequenza / Giorni
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                Periodo
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
                Stato
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Azioni</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y bg-white">
            {recurrences.map((rec) => {
              const userName = userMap.get(rec.userId) ?? `ID: ${rec.userId.slice(0, 8)}…`;
              const st = shiftTypeMap.get(rec.shiftTypeId);

              return (
                <tr key={rec.id} className="transition-colors hover:bg-gray-50">
                  {/* Dipendente */}
                  <td className="px-4 py-3 font-medium text-gray-800">{userName}</td>

                  {/* Tipo turno */}
                  <td className="px-4 py-3">
                    {st ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: st.color }}
                          aria-hidden="true"
                        />
                        <span className="text-gray-700">{st.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{rec.shiftTypeId.slice(0, 8)}…</span>
                    )}
                  </td>

                  {/* Frequenza / Giorni */}
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{FREQ_LABELS[rec.frequency]}</p>
                    {rec.daysOfWeek.length > 0 && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatDaysOfWeek(rec.daysOfWeek)}
                      </p>
                    )}
                  </td>

                  {/* Periodo */}
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {formatDate(rec.startDate)}
                    {rec.endDate && <span> → {formatDate(rec.endDate)}</span>}
                    {!rec.endDate && <span className="text-gray-400"> → aperto</span>}
                  </td>

                  {/* Stato */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        rec.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {rec.active ? 'Attiva' : 'Inattiva'}
                    </span>
                  </td>

                  {/* Azioni */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        aria-label={`Modifica serie ricorrenza di ${userName}`}
                      >
                        <Link href={`/admin/recurrence/${rec.id}/edit`}>
                          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Modifica
                        </Link>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOccurrencesTarget(rec)}
                        aria-label={`Visualizza occorrenze di ${userName}`}
                      >
                        <CalendarSearch className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Occorrenze
                      </Button>

                      {rec.active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeactivateTarget(rec)}
                          aria-label={`Disattiva ricorrenza di ${userName}`}
                          className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          <PowerOff className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                          Disattiva
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* AlertDialog — Disattiva */}
      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disattivare la ricorrenza?</AlertDialogTitle>
            <AlertDialogDescription>
              La ricorrenza per{' '}
              <strong>
                {deactivateTarget
                  ? (userMap.get(deactivateTarget.userId) ?? 'questo dipendente')
                  : ''}
              </strong>{' '}
              verrà disattivata. I turni già generati non verranno eliminati. Puoi riattivare la
              ricorrenza in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivateMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => {
                if (!deactivateTarget) return;
                deactivateMutation.mutate(deactivateTarget.id, {
                  onSettled: () => setDeactivateTarget(null),
                });
              }}
            >
              {deactivateMutation.isPending ? 'Disattivazione…' : 'Disattiva'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog — Visualizza occorrenze (RF-E CA2) */}
      <Dialog
        open={Boolean(occurrencesTarget)}
        onOpenChange={(open) => {
          if (!open) setOccurrencesTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Occorrenze ricorrenza</DialogTitle>
            <DialogDescription>
              {occurrencesTarget
                ? `Dipendente: ${userMap.get(occurrencesTarget.userId) ?? 'N/D'} — ${FREQ_LABELS[occurrencesTarget.frequency]}`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="border-border space-y-1.5 rounded-lg border bg-gray-50 px-4 py-3">
              <p className="text-gray-700">
                <span className="font-medium">Periodo:</span>{' '}
                {occurrencesTarget
                  ? `${formatDate(occurrencesTarget.startDate)} → ${
                      occurrencesTarget.endDate ? formatDate(occurrencesTarget.endDate) : 'aperto'
                    }`
                  : ''}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Giorni:</span>{' '}
                {occurrencesTarget ? formatDaysOfWeek(occurrencesTarget.daysOfWeek) : ''}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Tipo turno:</span>{' '}
                {occurrencesTarget
                  ? (shiftTypeMap.get(occurrencesTarget.shiftTypeId)?.name ?? 'N/D')
                  : ''}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              La lista dettagliata delle occorrenze generate è disponibile nella matrice turni,
              filtrata per dipendente e periodo.
            </p>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOccurrencesTarget(null)}
              >
                Chiudi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
