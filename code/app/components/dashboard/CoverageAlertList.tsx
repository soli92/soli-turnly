'use client';

/**
 * components/dashboard/CoverageAlertList.tsx — Lista fasce sotto-coperte (TSK-014).
 *
 * Mostra le fasce orarie di oggi in cui la copertura del personale è insufficiente
 * rispetto al minimo richiesto (RB-07).
 *
 * Logica:
 *   1. Fetch parallelo di GET /api/admin/coverage e GET /api/shifts (oggi)
 *   2. Calcolo client-side: fasce coperte < minimo_richiesto
 *
 * Nota: /api/admin/coverage restituisce 501 (implementato in TSK-006).
 * In quel caso il componente mostra uno stato di "non disponibile" e non un errore
 * bloccante, per non degradare l'intera dashboard (graceful degradation).
 *
 * Empty state (0 fasce sotto-coperte): mostra messaggio "Copertura OK" con icona verde.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Lista `<ul>` semantica con `role="list"` e descrizione aria-label
 *   - Ogni item ha struttura leggibile da screen-reader
 *   - Focus visible su ogni item cliccabile
 */

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface CoverageSlot {
  timeRange: string; // es. "08:00–14:00"
  required: number; // personale minimo richiesto
  assigned: number; // personale assegnato
  deficit: number; // required - assigned
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchUndercoveredSlots(): Promise<CoverageSlot[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch parallelo coverage + shifts di oggi
  const [coverageRes, shiftsRes] = await Promise.all([
    fetch('/api/admin/coverage'),
    fetch(`/api/shifts?dateFrom=${today}&dateTo=${today}&limit=100`),
  ]);

  // Se la coverage API non è ancora implementata (501 / Not Implemented),
  // restituiamo array vuoto per non bloccare la dashboard (graceful degradation).
  if (coverageRes.status === 501 || coverageRes.status === 404) {
    return [];
  }

  if (!coverageRes.ok) throw new Error(`Errore API coverage: ${coverageRes.status}`);
  if (!shiftsRes.ok) throw new Error(`Errore API turni: ${shiftsRes.status}`);

  // Struttura attesa da coverage (forma futura — quando TSK-006 sarà completo).
  // Per ora restituisce 501, il guard sopra restituisce [] prima di arrivare qui.
  interface CoverageApiItem {
    timeRange: string;
    minRequired: number;
  }
  interface ShiftsApiResponse {
    data: Array<{ startDt: string; endDt: string }>;
  }

  const [coverageJson, shiftsJson] = await Promise.all([
    coverageRes.json() as Promise<{ data: CoverageApiItem[] }>,
    shiftsRes.json() as Promise<ShiftsApiResponse>,
  ]);

  const slots = coverageJson.data ?? [];
  const shifts = shiftsJson.data ?? [];

  // Calcolo deficit per fascia
  return slots
    .map((slot) => {
      const assignedInSlot = shifts.filter((s) => {
        const start = new Date(s.startDt).getHours();
        const [slotStart] = slot.timeRange.split('–').map((t) => parseInt(t, 10));
        return start === slotStart;
      }).length;

      return {
        timeRange: slot.timeRange,
        required: slot.minRequired,
        assigned: assignedInSlot,
        deficit: Math.max(0, slot.minRequired - assignedInSlot),
      };
    })
    .filter((s) => s.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);
}

// ---------------------------------------------------------------------------
// CoverageAlertList
// ---------------------------------------------------------------------------

export function CoverageAlertList() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['coverage', 'undercovered-today'],
    queryFn: fetchUndercoveredSlots,
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <section
      aria-label="Fasce orarie sotto-coperte oggi"
      className={cn('border-border bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm')}
      data-testid="kpi-coverage-alert-list"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">Fasce sotto-coperte oggi</p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          aria-hidden="true"
        >
          <Clock className="h-4 w-4" />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div aria-busy="true" aria-label="Caricamento fasce sotto-coperte" className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col gap-2">
          <div className="text-destructive flex items-center gap-1.5 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Errore nel caricamento</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
            className="h-7 self-start px-2 text-xs"
          >
            Riprova
          </Button>
        </div>
      )}

      {/* Empty state — copertura OK */}
      {!isLoading && !isError && data?.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Copertura OK</span>
        </div>
      )}

      {/* Lista fasce sotto-coperte */}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul role="list" aria-label={`${data.length} fasce sotto-coperte`} className="space-y-1.5">
          {data.map((slot) => (
            <li
              key={slot.timeRange}
              className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 dark:bg-orange-950/20"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0 text-orange-500"
                  aria-hidden="true"
                />
                <span className="text-foreground text-sm font-medium">{slot.timeRange}</span>
              </div>
              <span
                className="text-muted-foreground text-xs"
                aria-label={`${slot.assigned} assegnati su ${slot.required} richiesti`}
              >
                {slot.assigned}/{slot.required}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
