'use client';

/**
 * components/employee/calendar/HoursSummaryBar.tsx
 *
 * Riepilogo ore del periodo visualizzato (RB-06, T-DOM-06).
 * Mostra:
 *   - Ore ordinarie pianificate
 *   - Ore straordinario (calcolate come max(0, totale - ore_contrattuali_periodo))
 *
 * Aggiornamento reattivo al cambio vista/periodo via props.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - region + aria-label per screen reader
 *   - aria-live="polite" per aggiornamenti dinamici
 */

interface HoursSummaryBarProps {
  totalHours: number;
  overtimeHours: number;
  isLoading?: boolean;
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

export function HoursSummaryBar({
  totalHours,
  overtimeHours,
  isLoading = false,
}: HoursSummaryBarProps) {
  const ordinaryHours = Math.max(0, totalHours - overtimeHours);

  return (
    <section
      aria-label="Riepilogo ore periodo"
      aria-live="polite"
      aria-busy={isLoading}
      className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 text-sm"
    >
      <span className="text-foreground font-medium">Ore periodo:</span>

      {isLoading ? (
        <span className="h-4 w-24 animate-pulse rounded bg-gray-200" aria-hidden="true" />
      ) : (
        <>
          {/* Ore ordinarie */}
          <span className="flex items-center gap-1.5">
            <span className="bg-primary inline-block h-2.5 w-2.5 rounded-full" aria-hidden="true" />
            <span className="text-foreground">
              <span className="sr-only">Ore ordinarie: </span>
              {formatHours(ordinaryHours)}
              <span className="text-muted-foreground ml-1 text-xs">ordinarie</span>
            </span>
          </span>

          {/* Ore straordinario — mostrate solo se > 0 */}
          {overtimeHours > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500"
                aria-hidden="true"
              />
              <span className="font-medium text-orange-700">
                <span className="sr-only">Ore straordinario: </span>+{formatHours(overtimeHours)}
                <span className="ml-1 text-xs font-normal">straordinario</span>
              </span>
            </span>
          )}

          {/* Totale */}
          <span className="text-muted-foreground ml-auto text-xs">
            Totale: {formatHours(totalHours)}
          </span>
        </>
      )}
    </section>
  );
}
