'use client';

/**
 * app/(admin)/swap/_components/ShiftSearchPanel.tsx — TSK-026.
 *
 * Pannello ricerca turno: seleziona dipendente + (opzionale) filtro data,
 * mostra la lista dei turni disponibili per la selezione.
 *
 * Flusso:
 *   1. Admin sceglie il dipendente dal select.
 *   2. Carica i turni del dipendente via useUserShifts.
 *   3. Admin seleziona il turno dalla lista; callback onShiftSelect(shift).
 *
 * AC: Stato iniziale mostra placeholder "Seleziona turno".
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Loader2, ChevronRight } from 'lucide-react';

import { useUserShifts } from '@/hooks/useSwap';
import type { ShiftSearchResult } from '@/hooks/useSwap';

interface UserMinimal {
  id: string;
  firstName: string;
  lastName: string;
}

interface ShiftSearchPanelProps {
  /** Etichetta del pannello (es. "Dipendente A"). */
  label: string;
  users: UserMinimal[];
  /** ID del turno già selezionato (per evidenziare la riga). */
  selectedShiftId: string | null;
  /** Callback quando l'admin seleziona un turno dalla lista. */
  onShiftSelect: (shift: ShiftSearchResult, user: UserMinimal) => void;
}

export function ShiftSearchPanel({
  label,
  users,
  selectedShiftId,
  onShiftSelect,
}: ShiftSearchPanelProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  const {
    data: shiftsData,
    isLoading,
    isError,
  } = useUserShifts(selectedUserId || null, dateFilter || undefined);

  function handleUserChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedUserId(e.target.value);
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDateFilter(e.target.value);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">{label}</h3>

      {/* Selezione dipendente */}
      <div>
        <label
          htmlFor={`user-select-${label}`}
          className="mb-1 block text-xs font-medium text-gray-600"
        >
          Dipendente
        </label>
        <select
          id={`user-select-${label}`}
          value={selectedUserId}
          onChange={handleUserChange}
          className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-2 focus:outline-none"
          aria-label={`Seleziona dipendente per ${label}`}
        >
          <option value="">— Seleziona dipendente —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.lastName} {u.firstName}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro data opzionale */}
      {selectedUserId && (
        <div>
          <label
            htmlFor={`date-filter-${label}`}
            className="mb-1 block text-xs font-medium text-gray-600"
          >
            Filtra da data (opzionale)
          </label>
          <input
            id={`date-filter-${label}`}
            type="date"
            value={dateFilter}
            onChange={handleDateChange}
            className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-2 focus:outline-none"
            aria-label={`Filtra turni per data — ${label}`}
          />
        </div>
      )}

      {/* Lista turni */}
      {!selectedUserId && <p className="text-sm text-gray-400">Seleziona prima un dipendente.</p>}

      {selectedUserId && isLoading && (
        <div
          role="status"
          aria-label="Caricamento turni"
          className="flex items-center gap-2 py-3 text-sm text-gray-500"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Caricamento turni…
        </div>
      )}

      {selectedUserId && isError && (
        <p role="alert" className="text-sm text-red-600">
          Errore nel caricamento dei turni.
        </p>
      )}

      {selectedUserId && !isLoading && !isError && shiftsData && shiftsData.length === 0 && (
        <p className="text-sm text-gray-400">
          Nessun turno disponibile
          {dateFilter ? ` da ${format(new Date(dateFilter), 'dd/MM/yyyy', { locale: it })}` : ''}.
        </p>
      )}

      {selectedUserId && !isLoading && !isError && shiftsData && shiftsData.length > 0 && (
        <ul
          className="border-border max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-md border"
          aria-label={`Turni di ${selectedUser?.lastName} ${selectedUser?.firstName}`}
        >
          {shiftsData.map((shift) => {
            const isSelected = shift.id === selectedShiftId;
            const startDate = new Date(shift.startDt);
            const endDate = new Date(shift.endDt);

            return (
              <li key={shift.id}>
                <button
                  type="button"
                  onClick={() => selectedUser && onShiftSelect(shift, selectedUser)}
                  aria-pressed={isSelected}
                  aria-label={`Turno del ${format(new Date(shift.date), 'dd/MM/yyyy', { locale: it })}, ${format(startDate, 'HH:mm')}–${format(endDate, 'HH:mm')}`}
                  className={[
                    'flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <div className="space-y-0.5">
                    <div className="font-medium capitalize">
                      {format(new Date(shift.date), 'EEEE d MMMM', { locale: it })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-gray-300'}`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
