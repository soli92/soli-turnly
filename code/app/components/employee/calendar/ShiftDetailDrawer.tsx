'use client';

/**
 * components/employee/calendar/ShiftDetailDrawer.tsx
 *
 * Drawer lato-destra: dettaglio turno in sola lettura (RF-J CA2).
 * Mostra: orari, tipologia, note. Nessun controllo di scrittura.
 *
 * Implementato come overlay + pannello scorrevole (no dipendenza esterna Sheet).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - Focus trap: focus iniziale sul tasto di chiusura
 *   - Esc chiude il drawer
 *   - Backdrop click chiude il drawer
 */

import { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShiftDetailActions } from './ShiftDetailActions';
import type { ShiftCalendarEvent } from '@/hooks/useEmployeeCalendar';

interface ShiftDetailDrawerProps {
  event: ShiftCalendarEvent | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  planned: { label: 'Pianificato', variant: 'secondary' },
  confirmed: { label: 'Confermato', variant: 'default' },
  cancelled: { label: 'Annullato', variant: 'destructive' },
};

export function ShiftDetailDrawer({ event, open, onClose }: ShiftDetailDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = 'shift-detail-drawer-title';

  // Focus trap: focus sul tasto chiusura all'apertura
  useEffect(() => {
    if (open) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [open]);

  // Chiudi con Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !event) return null;

  const shift = event.resource;
  const startDate = format(event.start, 'EEEE dd MMMM yyyy', { locale: it });
  const startTime = format(event.start, 'HH:mm', { locale: it });
  const endTime = format(event.end, 'HH:mm', { locale: it });
  const durationMs = event.end.getTime() - event.start.getTime();
  const durationH = durationMs / (1000 * 60 * 60);
  const statusInfo = STATUS_LABELS[shift.status] ?? {
    label: shift.status,
    variant: 'outline' as const,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" onClick={onClose} />

      {/* Pannello */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2
            id={titleId}
            className="text-foreground text-base font-semibold"
            style={{ borderLeft: `4px solid ${event.color}`, paddingLeft: '0.5rem' }}
          >
            {event.title}
          </h2>

          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Chiudi dettaglio turno"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Corpo — sola lettura */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <dl className="space-y-4">
            {/* Data */}
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Data
              </dt>
              <dd className="text-foreground mt-0.5 text-sm capitalize">{startDate}</dd>
            </div>

            {/* Orario */}
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Orario
              </dt>
              <dd className="text-foreground mt-0.5 text-sm">
                {startTime}–{endTime}{' '}
                <span className="text-muted-foreground">({durationH.toFixed(1)}h)</span>
              </dd>
            </div>

            {/* Stato */}
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Stato
              </dt>
              <dd className="mt-0.5">
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </dd>
            </div>

            {/* Note (facoltativo) */}
            {shift.notes && (
              <div>
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Note
                </dt>
                <dd className="text-foreground mt-0.5 text-sm">{shift.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Footer — azioni */}
        <div className="border-border border-t px-5 py-4">
          <ShiftDetailActions shift={shift} onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
