'use client';

/**
 * components/absences/AbsenceTypeBadge.tsx — Pill colorata tipo assenza (TSK-017).
 *
 * Visualizza il tipo di assenza come badge colorato:
 *   ferie           → verde
 *   malattia        → rosso
 *   permesso        → blu
 *   maternita-paternita → viola
 *   altro           → grigio
 *
 * Accessibility: WCAG 2.2 AA
 * - Il colore non è l'unico indicatore (testo sempre visibile)
 * - aria-label sul badge per screen reader
 */

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Configurazione palette
// ---------------------------------------------------------------------------

const ABSENCE_TYPE_CONFIG = {
  ferie: {
    label: 'Ferie',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  malattia: {
    label: 'Malattia',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  permesso: {
    label: 'Permesso',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  'maternita-paternita': {
    label: 'Mat./Pat.',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  altro: {
    label: 'Altro',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
} as const;

export type AbsenceTypeKey = keyof typeof ABSENCE_TYPE_CONFIG;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbsenceTypeBadgeProps {
  type: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AbsenceTypeBadge({ type, className }: AbsenceTypeBadgeProps) {
  const config = ABSENCE_TYPE_CONFIG[type as AbsenceTypeKey] ?? ABSENCE_TYPE_CONFIG.altro;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
      aria-label={`Tipo assenza: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

/**
 * Restituisce il label leggibile di un tipo assenza.
 * Utile dove serve solo il testo, non il componente badge.
 */
export function getAbsenceTypeLabel(type: string): string {
  return ABSENCE_TYPE_CONFIG[type as AbsenceTypeKey]?.label ?? type;
}
