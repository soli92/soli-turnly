'use client';

/**
 * app/(admin)/swap/_components/SelectedShiftCard.tsx — TSK-026.
 *
 * Mostra le informazioni di un turno selezionato:
 *   - Dipendente (nome + cognome)
 *   - Data del turno
 *   - Orario inizio–fine
 *   - Pulsante per deselezionare
 *
 * Se nessun turno è selezionato mostra un placeholder.
 */

import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { X, Clock, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ShiftSearchResult } from '@/hooks/useSwap';

interface UserMinimal {
  id: string;
  firstName: string;
  lastName: string;
}

interface SelectedShiftCardProps {
  /** Etichetta del pannello (es. "Turno A" o "Turno B"). */
  label: string;
  shift: ShiftSearchResult | null;
  user: UserMinimal | null;
  onClear: () => void;
}

export function SelectedShiftCard({ label, shift, user, onClear }: SelectedShiftCardProps) {
  if (!shift || !user) {
    return (
      <div
        aria-label={`${label} — nessun turno selezionato`}
        className="flex min-h-[96px] items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-400"
      >
        Seleziona turno
      </div>
    );
  }

  const startDate = new Date(shift.startDt);
  const endDate = new Date(shift.endDt);

  const formattedDate = format(new Date(shift.date), 'EEEE d MMMM yyyy', { locale: it });
  const formattedStart = format(startDate, 'HH:mm');
  const formattedEnd = format(endDate, 'HH:mm');

  return (
    <div
      aria-label={`${label} — ${user.firstName} ${user.lastName}, ${formattedDate}`}
      className="border-border relative rounded-lg border bg-white p-4 shadow-sm"
    >
      {/* Pulsante deseleziona */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-gray-400 hover:text-gray-600"
        aria-label={`Deseleziona ${label}`}
        onClick={onClear}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* Intestazione — dipendente */}
      <div className="flex items-center gap-2 pr-8">
        <User className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="truncate text-sm font-semibold text-gray-900">
          {user.firstName} {user.lastName}
        </span>
      </div>

      {/* Data */}
      <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
        <Calendar className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span className="capitalize">{formattedDate}</span>
      </div>

      {/* Orario */}
      <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
        <Clock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <span>
          {formattedStart} – {formattedEnd}
        </span>
      </div>
    </div>
  );
}
