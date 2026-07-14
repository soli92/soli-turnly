'use client';

/**
 * components/employee/calendar/ShiftEvent.tsx
 *
 * Evento custom per React Big Calendar.
 * Mostra tipologia turno + orario, colorato per tipologia (RF-J).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="button" + tabIndex + onKeyDown per tastiera
 *   - aria-label con dettaglio completo per screen reader
 *   - contrasto testo su background garantito (testo bianco su colori medio-scuri)
 */

import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { ShiftCalendarEvent } from '@/hooks/useEmployeeCalendar';

interface ShiftEventProps {
  event: ShiftCalendarEvent;
  onClick?: (event: ShiftCalendarEvent) => void;
}

export function ShiftEvent({ event, onClick }: ShiftEventProps) {
  const startLabel = format(event.start, 'HH:mm', { locale: it });
  const endLabel = format(event.end, 'HH:mm', { locale: it });

  const ariaLabel = `${event.title} dalle ${startLabel} alle ${endLabel}`;

  function handleClick() {
    onClick?.(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(event);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      style={{ backgroundColor: event.color }}
      className="flex h-full cursor-pointer flex-col justify-start overflow-hidden rounded px-1 py-0.5 text-white select-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:outline-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="truncate text-xs leading-tight font-semibold">{event.title}</span>
      <span className="truncate text-[10px] leading-tight opacity-90">
        {startLabel}–{endLabel}
      </span>
    </div>
  );
}
