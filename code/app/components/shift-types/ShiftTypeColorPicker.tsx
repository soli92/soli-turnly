'use client';

/**
 * components/shift-types/ShiftTypeColorPicker.tsx — Swatch colori predefiniti.
 *
 * Mostra una griglia di colori predefiniti; l'utente ne seleziona uno.
 * Integrato in ShiftTypeModal come campo "colore".
 *
 * Accessibility: WCAG 2.2 AA
 *   - role="radiogroup" per comunicare la selezione mutualmente esclusiva
 *   - aria-checked su ogni swatch
 *   - aria-label con nome colore approssimativo
 *   - Focus visible con ring
 */

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Palette predefinita (12 colori)
// ---------------------------------------------------------------------------

export const SHIFT_TYPE_PRESET_COLORS: { hex: string; label: string }[] = [
  { hex: '#EF4444', label: 'Rosso' },
  { hex: '#F97316', label: 'Arancione' },
  { hex: '#EAB308', label: 'Giallo' },
  { hex: '#22C55E', label: 'Verde' },
  { hex: '#06B6D4', label: 'Azzurro' },
  { hex: '#3B82F6', label: 'Blu' },
  { hex: '#8B5CF6', label: 'Viola' },
  { hex: '#EC4899', label: 'Rosa' },
  { hex: '#6B7280', label: 'Grigio' },
  { hex: '#14B8A6', label: 'Teal' },
  { hex: '#F59E0B', label: 'Ambra' },
  { hex: '#84CC16', label: 'Verde lime' },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface ShiftTypeColorPickerProps {
  /** Valore corrente (hex string, es. "#3B82F6"). */
  value: string;
  /** Callback invocata al cambio colore. */
  onChange: (color: string) => void;
  /** Classi CSS aggiuntive sul wrapper. */
  className?: string;
}

export function ShiftTypeColorPicker({ value, onChange, className }: ShiftTypeColorPickerProps) {
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      role="radiogroup"
      aria-label="Seleziona colore turno"
    >
      {SHIFT_TYPE_PRESET_COLORS.map(({ hex, label }) => {
        const isSelected = value === hex;
        return (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label} (${hex})`}
            title={label}
            onClick={() => onChange(hex)}
            className={cn(
              'h-7 w-7 rounded-full border-2 transition-all',
              'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
              'hover:scale-110',
              isSelected
                ? 'scale-110 border-gray-900 shadow-md'
                : 'border-transparent hover:border-gray-400'
            )}
            style={{ backgroundColor: hex }}
          />
        );
      })}
    </div>
  );
}
