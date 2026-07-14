'use client';

/**
 * components/employee/calendar/CalendarToolbar.tsx
 *
 * Toolbar custom per React Big Calendar.
 * Funzionalità:
 *   - Navigazione precedente / successivo / oggi
 *   - Label periodo corrente
 *   - Toggle viste: mese / settimana / giorno
 *   - Export .ics del periodo visualizzato
 *
 * Usa la firma ufficiale ToolbarProps<TEvent, TResource> di react-big-calendar.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - aria-label su tutti i pulsanti di navigazione
 *   - aria-current="true" sul pulsante della vista attiva
 *   - aria-label sulla toolbar
 */

import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import type { ToolbarProps, View } from 'react-big-calendar';
import { Button } from '@/components/ui/button';
import type { ShiftCalendarEvent } from '@/hooks/useEmployeeCalendar';

const VIEW_LABELS: Partial<Record<View, string>> = {
  month: 'Mese',
  week: 'Settimana',
  day: 'Giorno',
};

const SUPPORTED_VIEWS: View[] = ['month', 'week', 'day'];

export function CalendarToolbar(props: ToolbarProps<ShiftCalendarEvent>) {
  const { date, view, onNavigate, onView, label } = props;

  // Calcola il range del periodo corrente per il filename export
  function getPeriodRange(): { from: string; to: string } {
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    if (view === 'month') {
      return {
        from: fmt(startOfMonth(date)),
        to: fmt(endOfMonth(date)),
      };
    }
    if (view === 'week') {
      return {
        from: fmt(startOfWeek(date, { weekStartsOn: 1 })),
        to: fmt(endOfWeek(date, { weekStartsOn: 1 })),
      };
    }
    // day (e work_week, agenda — default a giorno)
    const day = fmt(date);
    return { from: day, to: day };
  }

  function handleExport() {
    const { from, to } = getPeriodRange();
    const params = new URLSearchParams({ from, to });
    window.location.href = `/api/users/me/shifts/export?${params.toString()}`;
  }

  const periodLabel =
    label || format(date, view === 'day' ? 'EEEE dd MMMM yyyy' : 'MMMM yyyy', { locale: it });

  return (
    <nav
      aria-label="Navigazione calendario turni"
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      {/* Navigazione prev/oggi/next */}
      <div className="flex items-center gap-1" role="group" aria-label="Navigazione temporale">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Periodo precedente"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="px-3"
          aria-label="Torna al periodo odierno"
          onClick={() => onNavigate('TODAY')}
        >
          Oggi
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Periodo successivo"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Label periodo corrente */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="text-foreground flex-1 text-center text-sm font-semibold capitalize sm:text-base"
      >
        {periodLabel}
      </span>

      {/* Toggle viste */}
      <div role="group" aria-label="Seleziona visualizzazione" className="flex items-center gap-1">
        {SUPPORTED_VIEWS.map((v) => (
          <Button
            key={v}
            variant={view === v ? 'default' : 'outline'}
            size="sm"
            aria-current={view === v ? 'true' : undefined}
            aria-label={`Visualizzazione ${VIEW_LABELS[v] ?? v}`}
            onClick={() => onView(v)}
            className="px-3"
          >
            {VIEW_LABELS[v] ?? v}
          </Button>
        ))}
      </div>

      {/* Export .ics */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 px-3"
        aria-label="Esporta turni del periodo come file .ics"
        data-testid="export-ics-btn"
        onClick={handleExport}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Esporta .ics</span>
      </Button>
    </nav>
  );
}
