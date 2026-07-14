'use client';

/**
 * OvertimeRowBadge.tsx — Badge "Sopra soglia" per ore straordinarie (TSK-027).
 *
 * Mostra un badge rosso se overtimeHours > maxStraordinarioMensileOre (40h, RB-06 RF-I CA2).
 * Accessibilità WCAG 2.2 AA: usa aria-label esplicito per screen reader.
 */

interface OvertimeRowBadgeProps {
  /** true se overtimeHours > 40 (maxStraordinarioMensileOre, RB-06) */
  exceedsThreshold: boolean;
  /** Valore ore straordinarie per l'aria-label */
  overtimeHours: number;
}

export function OvertimeRowBadge({ exceedsThreshold, overtimeHours }: OvertimeRowBadgeProps) {
  if (!exceedsThreshold) return null;

  return (
    <span
      role="status"
      aria-label={`Sopra soglia: ${overtimeHours.toFixed(2)}h di straordinario, oltre il limite mensile di 40h`}
      className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-red-200 ring-inset"
    >
      Sopra soglia
    </span>
  );
}
