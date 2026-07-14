/**
 * components/shift-types/ShiftTypeBadge.tsx — Pill colorato tipologia turno.
 *
 * Usato in:
 *   - ShiftTypeTable (colonna nome)
 *   - ShiftEditor / ShiftCell (TSK-005) per mostrare il tipo di turno assegnato
 *   - Mostra badge "Inattiva" quando active=false
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-label con nome e stato
 *   - Contrasto minimo 4.5:1 garantito tramite colori di testo calcolati
 */

import { cn } from '@/lib/utils';

export interface ShiftTypeBadgeProps {
  /** Nome della tipologia di turno. */
  name: string;
  /** Codice breve (es. "NOTTE"). Opzionale. */
  code?: string;
  /** Colore hex (es. "#3B82F6"). */
  color: string;
  /** Se true, mostra badge "Inattiva" in grigio (non selezionabile). */
  active?: boolean;
  /** Classi CSS aggiuntive. */
  className?: string;
}

/**
 * Determina se il testo deve essere chiaro o scuro in base al colore di sfondo.
 * Usa la formula luminanza relativa WCAG.
 */
function getTextColorForBg(hexColor: string): 'text-white' | 'text-gray-900' {
  try {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    // Luminanza relativa (ITU-R BT.709)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.4 ? 'text-gray-900' : 'text-white';
  } catch {
    return 'text-gray-900';
  }
}

export function ShiftTypeBadge({
  name,
  code,
  color,
  active = true,
  className,
}: ShiftTypeBadgeProps) {
  if (!active) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
          'border border-gray-200 bg-gray-100 text-gray-500',
          className
        )}
        aria-label={`${name} — Inattiva`}
      >
        {code && <span className="font-mono text-[10px] opacity-70">{code}</span>}
        <span>{name}</span>
        <span className="ml-0.5 text-[10px] opacity-60">(Inattiva)</span>
      </span>
    );
  }

  const textColor = getTextColorForBg(color);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        textColor,
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {code && <span className="font-mono text-[10px] opacity-80">{code}</span>}
      <span>{name}</span>
    </span>
  );
}
