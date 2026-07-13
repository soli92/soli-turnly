'use client';

/**
 * components/matrix/WeekNavigator.tsx — Navigazione settimana/mese.
 *
 * Bottoni freccia per avanzare/retrocedere di una settimana (o mese).
 * Mostra il range di date corrente.
 *
 * Props:
 *   currentDate   - Data di riferimento (primo giorno del periodo visibile)
 *   viewMode      - 'week' | 'month'
 *   onNavigate    - Callback con la nuova data di riferimento
 *
 * Accessibility: WCAG 2.2 AA
 * - aria-label descrittivo su ogni bottone
 * - Focus ring visibile
 */

import { format, addWeeks, subWeeks, addMonths, subMonths, endOfISOWeek, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeekNavigatorProps {
  currentDate: Date;
  viewMode: 'week' | 'month';
  onNavigate: (newDate: Date) => void;
}

export function WeekNavigator({
  currentDate,
  viewMode,
  onNavigate,
}: WeekNavigatorProps) {
  const handlePrev = () => {
    if (viewMode === 'week') {
      onNavigate(subWeeks(currentDate, 1));
    } else {
      onNavigate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      onNavigate(addWeeks(currentDate, 1));
    } else {
      onNavigate(addMonths(currentDate, 1));
    }
  };

  const rangeLabel =
    viewMode === 'week'
      ? `${format(currentDate, 'd MMM', { locale: it })} – ${format(endOfISOWeek(currentDate), 'd MMM yyyy', { locale: it })}`
      : `${format(startOfMonth(currentDate), 'MMMM yyyy', { locale: it })}`;

  return (
    <div className="flex items-center gap-1" role="navigation" aria-label="Navigazione periodo">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrev}
        aria-label={
          viewMode === 'week' ? 'Settimana precedente' : 'Mese precedente'
        }
        data-testid="week-navigator-prev"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>

      <span
        className="min-w-[160px] text-center text-sm font-medium text-gray-700"
        aria-live="polite"
        aria-atomic="true"
      >
        {rangeLabel}
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        aria-label={
          viewMode === 'week' ? 'Settimana successiva' : 'Mese successivo'
        }
        data-testid="week-navigator-next"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
