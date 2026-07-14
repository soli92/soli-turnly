'use client';

/**
 * components/employee/calendar/EmployeeCalendar.tsx
 *
 * Calendario turni dipendente con React Big Calendar (RF-J, F5).
 * Viste: mese / settimana / giorno con navigazione e toolbar custom.
 *
 * Sicurezza (T-SEC-01/02):
 *   - I dati vengono da /api/shifts che filtra per userId del token
 *   - initialData viene dall'RSC (fetch lato server con userId dal token)
 *
 * Mobile (375px):
 *   - Vista default "giorno" su schermi piccoli
 *   - Scroll verticale per turni sovrapposti (overflow-y: auto)
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Landmark <section> + aria-label
 *   - Gli eventi hanno role="button" + keyboard navigation (ShiftEvent)
 *   - Toolbar con aria-label e aria-current
 *   - ShiftDetailDrawer con role="dialog" + focus management
 */

import { useState, useCallback, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import type { EventProps } from 'react-big-calendar';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  addDays,
  endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';

// React Big Calendar styles — importati nel client component (TSK-021)
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useEmployeeCalendar } from '@/hooks/useEmployeeCalendar';
import type { ShiftCalendarEvent } from '@/hooks/useEmployeeCalendar';
import type { ShiftRow } from '@/types';
import { CalendarToolbar } from './CalendarToolbar';
import { ShiftEvent } from './ShiftEvent';
import { ShiftDetailDrawer } from './ShiftDetailDrawer';
import { HoursSummaryBar } from './HoursSummaryBar';

// ---------------------------------------------------------------------------
// date-fns localizer (italiano, settimana inizia lunedì)
// ---------------------------------------------------------------------------

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { it },
});

// ---------------------------------------------------------------------------
// Messaggi in italiano per React Big Calendar
// ---------------------------------------------------------------------------

const messages = {
  allDay: 'Tutto il giorno',
  previous: 'Precedente',
  next: 'Successivo',
  today: 'Oggi',
  month: 'Mese',
  week: 'Settimana',
  day: 'Giorno',
  agenda: 'Agenda',
  date: 'Data',
  time: 'Orario',
  event: 'Turno',
  noEventsInRange: 'Nessun turno in questo periodo.',
  showMore: (total: number) => `+${total} altri`,
};

// ---------------------------------------------------------------------------
// Calcola range [from, to] in base a vista + data corrente
// ---------------------------------------------------------------------------

function computeRange(view: View, date: Date): { from: string; to: string } {
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

  if (view === 'month') {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    return {
      from: fmt(addDays(startOfWeek(monthStart, { weekStartsOn: 1 }), 0)),
      to: fmt(addDays(endOfWeek(monthEnd, { weekStartsOn: 1 }), 0)),
    };
  }

  if (view === 'week' || view === 'work_week') {
    return {
      from: fmt(startOfWeek(date, { weekStartsOn: 1 })),
      to: fmt(endOfWeek(date, { weekStartsOn: 1 })),
    };
  }

  // day / agenda
  const day = fmt(date);
  return { from: day, to: day };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeCalendarProps {
  /** Dati iniziali dal server (RSC page.tsx). Possono includere shiftTypeColor. */
  initialShifts?: ShiftRow[];
  /** Ore contrattuali settimanali per il calcolo straordinario. Default 40. */
  contractHoursPerWeek?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function EmployeeCalendar({
  initialShifts,
  contractHoursPerWeek = 40,
}: EmployeeCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>('month');
  const [selectedEvent, setSelectedEvent] = useState<ShiftCalendarEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Range del periodo visualizzato
  const { from, to } = useMemo(
    () => computeRange(currentView, currentDate),
    [currentView, currentDate]
  );

  // Opzioni query — usa initialData RSC solo per il primo render
  const queryOptions = useMemo(() => {
    if (initialShifts && initialShifts.length > 0) {
      return { initialData: initialShifts };
    }
    return {};
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch turni dipendente per il periodo corrente
  const { events, totalHours, overtimeHours, isLoading } = useEmployeeCalendar(
    from,
    to,
    contractHoursPerWeek,
    queryOptions
  );

  // Apertura drawer su selezione evento
  const handleSelectEvent = useCallback((event: ShiftCalendarEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
  }, []);

  // Stile custom evento (colore da tipologia)
  const eventPropGetter = useCallback(
    (event: ShiftCalendarEvent) => ({
      style: {
        backgroundColor: event.color,
        border: 'none',
      },
    }),
    []
  );

  // Wrapper evento custom — rispetta EventProps<ShiftCalendarEvent>
  const EventComponent = useCallback(
    ({ event }: EventProps<ShiftCalendarEvent>) => (
      <ShiftEvent event={event} onClick={handleSelectEvent} />
    ),
    [handleSelectEvent]
  );

  const components = useMemo(
    () => ({
      event: EventComponent,
      toolbar: CalendarToolbar,
    }),
    [EventComponent]
  );

  return (
    <section aria-label="Calendario turni personali">
      {/* Riepilogo ore */}
      <HoursSummaryBar
        totalHours={totalHours}
        overtimeHours={overtimeHours}
        isLoading={isLoading}
      />

      {/* Calendario */}
      <div className="rbc-calendar-wrapper mt-3" style={{ minHeight: '620px' }}>
        {isLoading && events.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            className="text-muted-foreground flex items-center justify-center py-12 text-sm"
          >
            Caricamento turni...
          </div>
        )}

        <Calendar<ShiftCalendarEvent>
          localizer={localizer}
          events={events}
          view={currentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onView={setCurrentView}
          onSelectEvent={(event) => handleSelectEvent(event)}
          eventPropGetter={eventPropGetter}
          components={components}
          messages={messages}
          culture="it"
          popup
          selectable={false}
          style={{ height: 620 }}
        />
      </div>

      {/* Drawer dettaglio turno */}
      <ShiftDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </section>
  );
}
