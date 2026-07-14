'use client';

/**
 * components/requests/RequestQueueFilters.tsx — Barra filtri per la coda richieste.
 *
 * Filtri:
 *   - Tipo richiesta: tutti | assenza | scambio turno | nuovo turno | modifica turno
 *   - Stato: tutti | in attesa | attesa collega | approvate | rifiutate | applicate
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="group" sui gruppi di filtri con aria-label descrittivo
 *   - aria-pressed sui toggle attivi
 *   - Label visibile su ogni Select
 *
 * data-testid: request-queue-filters
 */

import type { RequestStatus, RequestType } from '@/hooks/useRequests';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS: Array<{ value: RequestStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'sent', label: 'In attesa' },
  { value: 'awaiting_colleague', label: 'Attesa collega' },
  { value: 'approved', label: 'Approvate' },
  { value: 'rejected', label: 'Rifiutate' },
  { value: 'applied', label: 'Applicate' },
  { value: 'cancelled', label: 'Annullate' },
  { value: 'draft', label: 'Bozze' },
];

export const TYPE_OPTIONS: Array<{ value: RequestType | 'all'; label: string }> = [
  { value: 'all', label: 'Tutti i tipi' },
  { value: 'absence', label: 'Assenza' },
  { value: 'shift_swap', label: 'Scambio turno' },
  { value: 'new_shift', label: 'Nuovo turno' },
  { value: 'modify_shift', label: 'Modifica turno' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RequestQueueFiltersProps {
  statusFilter: RequestStatus | 'all';
  typeFilter: RequestType | 'all';
  onStatusChange: (status: RequestStatus | 'all') => void;
  onTypeChange: (type: RequestType | 'all') => void;
  totalCount?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestQueueFilters({
  statusFilter,
  typeFilter,
  onStatusChange,
  onTypeChange,
  totalCount,
}: RequestQueueFiltersProps) {
  return (
    <div
      data-testid="request-queue-filters"
      className="border-border flex flex-col gap-4 rounded-lg border bg-white p-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Filtro stato */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-status" className="text-xs font-medium text-gray-600">
            Stato
          </Label>
          <div
            role="group"
            aria-label="Filtra per stato richiesta"
            id="filter-status"
            className="flex flex-wrap gap-1.5"
          >
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={statusFilter === opt.value}
                onClick={() => onStatusChange(opt.value as RequestStatus | 'all')}
                className={[
                  'focus:ring-ring rounded-full px-3 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none',
                  statusFilter === opt.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro tipo */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-type" className="text-xs font-medium text-gray-600">
            Tipo
          </Label>
          <div
            role="group"
            aria-label="Filtra per tipo richiesta"
            id="filter-type"
            className="flex flex-wrap gap-1.5"
          >
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={typeFilter === opt.value}
                onClick={() => onTypeChange(opt.value as RequestType | 'all')}
                className={[
                  'focus:ring-ring rounded-full px-3 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none',
                  typeFilter === opt.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contatore risultati */}
      {totalCount !== undefined && (
        <p className="text-xs whitespace-nowrap text-gray-400" aria-live="polite">
          {totalCount} {totalCount === 1 ? 'risultato' : 'risultati'}
        </p>
      )}
    </div>
  );
}
