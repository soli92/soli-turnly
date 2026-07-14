'use client';

/**
 * components/employee/requests/new/ColleagueTurnPicker.tsx
 *
 * Componente per la selezione del turno di un collega (step 2b — scambio turno).
 *
 * Consuma: GET /api/shifts?available_for_swap=true
 *   - Restituisce i turni dei colleghi della stessa fascia disponibili per scambio.
 *   - Nota: il supporto BE per available_for_swap=true è in roadmap (TSK-023).
 *     Attualmente l'endpoint può restituire lista vuota o propri turni.
 *
 * Filtra per: data futura, non cancellati.
 * Mostra: data, orario, tipologia, nome collega (se disponibile).
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label sul select
 *   - stato di caricamento comunicato via aria-busy
 *
 * TSK-023
 */

import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAvailableSwapShifts, type AvailableSwapShift } from '@/hooks/useShifts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShiftOption(shift: AvailableSwapShift): string {
  const date = new Date(shift.startDt).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startTime = new Date(shift.startDt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(shift.endDt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const type = shift.shiftTypeName ?? shift.shiftTypeCode ?? '';
  const person = shift.userName ? ` — ${shift.userName}` : '';
  return `${date} ${startTime}–${endTime}${type ? ` (${type})` : ''}${person}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ColleagueTurnPickerProps {
  value: string;
  onChange: (shiftId: string) => void;
  /** Disabilita i turni con questo ID (turno proprio selezionato per lo scambio) */
  excludeShiftId?: string;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ColleagueTurnPicker({
  value,
  onChange,
  excludeShiftId,
  disabled,
}: ColleagueTurnPickerProps) {
  const { data: shifts, isLoading, isError } = useAvailableSwapShifts();

  const availableShifts = (shifts ?? []).filter(
    (s) => s.id !== excludeShiftId && s.status !== 'cancelled'
  );

  if (isLoading) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-2 py-2 text-sm"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Caricamento turni disponibili…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-destructive py-1 text-xs" role="alert">
        Errore nel caricamento dei turni disponibili. Riprova.
      </p>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || availableShifts.length === 0}
    >
      <SelectTrigger aria-label="Seleziona turno del collega" aria-required="true">
        <SelectValue
          placeholder={
            availableShifts.length === 0
              ? 'Nessun turno disponibile per lo scambio'
              : 'Seleziona il turno del collega'
          }
        />
      </SelectTrigger>
      <SelectContent>
        {availableShifts.length === 0 ? (
          <SelectItem value="__none__" disabled>
            Nessun turno disponibile al momento
          </SelectItem>
        ) : (
          availableShifts.map((shift) => (
            <SelectItem key={shift.id} value={shift.id}>
              {formatShiftOption(shift)}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
