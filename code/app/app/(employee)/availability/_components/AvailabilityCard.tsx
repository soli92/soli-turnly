'use client';

/**
 * app/(employee)/availability/_components/AvailabilityCard.tsx (TSK-025)
 *
 * Singola voce di disponibilità con:
 *   - Badge tipo colorato: verde=available, rosso=unavailable, giallo=preference
 *   - Descrizione leggibile (scope + definition)
 *   - Azione elimina con conferma
 *
 * Accessibility: WCAG 2.2 AA
 *   - Badge con role informativo
 *   - Bottone elimina con aria-label descrittivo
 */

import { useState } from 'react';
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
import { useDeleteAvailability, type AvailabilityRow } from '@/hooks/useAvailability';

// ---------------------------------------------------------------------------
// Configurazione badge tipo
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<AvailabilityRow['type'], { label: string; className: string }> = {
  available: {
    label: 'Disponibile',
    className: 'bg-green-100 text-green-800',
  },
  unavailable: {
    label: 'Non disponibile',
    className: 'bg-red-100 text-red-800',
  },
  preference: {
    label: 'Preferenza',
    className: 'bg-yellow-100 text-yellow-800',
  },
};

const SCOPE_LABELS: Record<AvailabilityRow['scope'], string> = {
  recurring: 'Ricorrente',
  date_range: 'Intervallo date',
};

const DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// ---------------------------------------------------------------------------
// Helper: descrizione human-readable della definition
// ---------------------------------------------------------------------------

function formatDefinition(row: AvailabilityRow): string {
  const def = row.definition;

  if (row.scope === 'recurring' && 'dayOfWeek' in def) {
    const day = DAY_NAMES[def.dayOfWeek] ?? `Giorno ${String(def.dayOfWeek)}`;
    return `${day} — ${def.startTime} / ${def.endTime}`;
  }

  if (row.scope === 'date_range' && 'startDate' in def) {
    const startFormatted = new Date(def.startDate).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const endFormatted = new Date(def.endDate).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeRange = def.startTime && def.endTime ? ` — ${def.startTime} / ${def.endTime}` : '';
    return `${startFormatted} → ${endFormatted}${timeRange}`;
  }

  return 'Definizione non disponibile';
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AvailabilityCardProps {
  row: AvailabilityRow;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AvailabilityCard({ row }: AvailabilityCardProps) {
  const deleteAvailability = useDeleteAvailability();
  const typeConfig = TYPE_CONFIG[row.type];
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div
      className="border-border flex items-start justify-between gap-3 rounded-lg border bg-white p-4"
      role="listitem"
    >
      {/* Contenuto principale */}
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Badges: tipo + scope */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeConfig.className}`}
            aria-label={`Tipo: ${typeConfig.label}`}
          >
            {typeConfig.label}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {SCOPE_LABELS[row.scope]}
          </span>
        </div>

        {/* Definizione */}
        <p className="truncate text-sm text-gray-900">{formatDefinition(row)}</p>

        {/* Note opzionali */}
        {row.notes && <p className="line-clamp-2 text-xs text-gray-500">{row.notes}</p>}
      </div>

      {/* Azione elimina */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={deleteAvailability.isPending}
        aria-label={`Elimina voce di disponibilità: ${typeConfig.label} — ${formatDefinition(row)}`}
        className="shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleteAvailability.isPending ? (
          <span
            aria-hidden="true"
            className="block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500"
          />
        ) : (
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        )}
      </button>

      {/* Errore inline eliminazione */}
      {deleteAvailability.isError && (
        <p role="alert" className="sr-only">
          {deleteAvailability.error?.message ?? "Errore durante l'eliminazione"}
        </p>
      )}

      {/* Conferma eliminazione */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la voce di disponibilità?</AlertDialogTitle>
            <AlertDialogDescription>
              La voce <strong>{typeConfig.label}</strong> — {formatDefinition(row)} verrà rimossa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAvailability.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAvailability.isPending}
              onClick={() => {
                deleteAvailability.mutate(row.id, { onSettled: () => setConfirmOpen(false) });
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
