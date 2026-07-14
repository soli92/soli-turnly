'use client';

/**
 * components/employee/requests/new/RequestTypeSelector.tsx
 *
 * Step 1 del wizard nuova richiesta: selezione tipo tra 4 card cliccabili.
 *
 * Quattro tipi:
 *   - assenza (Calendar)
 *   - scambio turno (ArrowLeftRight)
 *   - nuovo turno (Plus)
 *   - modifica turno (Edit3)
 *
 * Accessibility: WCAG 2.2 AA
 *   - fieldset + legend per il gruppo radio
 *   - aria-describedby per le descrizioni delle card
 *   - focus-within ring sui contenitori label
 *   - sr-only per gli input radio nascosti
 *
 * TSK-023
 */

import { Calendar, ArrowLeftRight, Plus, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { RequestType } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Configurazione opzioni
// ---------------------------------------------------------------------------

const REQUEST_TYPE_OPTIONS: {
  value: RequestType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'absence',
    label: 'Assenza',
    description: 'Ferie, malattia, permesso o altra assenza dal lavoro',
    Icon: Calendar,
  },
  {
    value: 'shift_swap',
    label: 'Scambio turno',
    description: 'Proponi uno scambio di turno con un collega',
    Icon: ArrowLeftRight,
  },
  {
    value: 'new_shift',
    label: 'Nuovo turno',
    description: 'Dichiara disponibilità a coprire un turno extra',
    Icon: Plus,
  },
  {
    value: 'modify_shift',
    label: 'Modifica turno',
    description: 'Proponi una modifica a un tuo turno esistente',
    Icon: Edit3,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestTypeSelectorProps {
  value: RequestType | null;
  onChange: (v: RequestType) => void;
  onNext: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestTypeSelector({
  value,
  onChange,
  onNext,
  onCancel,
}: RequestTypeSelectorProps) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm font-medium text-gray-700">
          Seleziona il tipo di richiesta
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {REQUEST_TYPE_OPTIONS.map(({ value: typeValue, label, description, Icon }) => (
            <label
              key={typeValue}
              data-testid={`request-type-radio-${typeValue}`}
              className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                'focus-within:ring-ring transition-colors focus-within:ring-2',
                value === typeValue
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-white hover:border-gray-400'
              )}
            >
              <input
                type="radio"
                name="requestType"
                value={typeValue}
                checked={value === typeValue}
                onChange={() => onChange(typeValue)}
                className="sr-only"
                aria-describedby={`desc-type-${typeValue}`}
              />
              <Icon
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  value === typeValue ? 'text-primary' : 'text-gray-400'
                )}
                aria-hidden="true"
              />
              <div>
                <span
                  className={cn(
                    'block text-sm font-medium',
                    value === typeValue ? 'text-primary' : 'text-gray-900'
                  )}
                >
                  {label}
                </span>
                <span id={`desc-type-${typeValue}`} className="mt-0.5 block text-xs text-gray-500">
                  {description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-between pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
        )}
        <Button
          type="button"
          onClick={onNext}
          disabled={!value}
          className={onCancel ? '' : 'ml-auto'}
          data-testid="type-selector-next-btn"
        >
          Avanti
        </Button>
      </div>
    </div>
  );
}
