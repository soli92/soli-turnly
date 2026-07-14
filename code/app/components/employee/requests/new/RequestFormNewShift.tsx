'use client';

/**
 * components/employee/requests/new/RequestFormNewShift.tsx
 *
 * Step 2c del wizard nuova richiesta: nuovo turno (disponibilità a coprire).
 *
 * Campi:
 *   - date: data singola (date picker YYYY-MM-DD, >= oggi)
 *   - shiftTypeId: tipologia turno desiderata (select da GET /api/shift-types)
 *   - notes: note facoltative
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-required sui campi obbligatori
 *   - aria-live="polite" sullo stato di caricamento tipologie
 *
 * TSK-023
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShiftTypes } from '@/hooks/useShiftTypes';

// ---------------------------------------------------------------------------
// Schema e tipo payload
// ---------------------------------------------------------------------------

const today = new Date().toISOString().slice(0, 10);

export const newShiftPayloadSchema = z.object({
  date: z
    .string()
    .min(1, 'Data obbligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido')
    .refine((d) => d >= today, 'Non puoi richiedere un turno nel passato'),
  shiftTypeId: z.string().min(1, 'Seleziona la tipologia di turno'),
  notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional(),
});

export type NewShiftPayload = z.infer<typeof newShiftPayloadSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestFormNewShiftProps {
  defaultValues?: Partial<NewShiftPayload>;
  onNext: (data: NewShiftPayload) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestFormNewShift({ defaultValues, onNext, onBack }: RequestFormNewShiftProps) {
  const { data: shiftTypes, isLoading: loadingTypes } = useShiftTypes();

  const form = useForm<NewShiftPayload>({
    resolver: zodResolver(newShiftPayloadSchema),
    defaultValues: {
      date: '',
      shiftTypeId: '',
      notes: '',
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onNext)(e)}
        className="space-y-4"
        noValidate
        aria-label="Dettagli nuovo turno"
      >
        {/* Data */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Data turno richiesto{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                <Input type="date" aria-required="true" min={today} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tipologia turno */}
        <FormField
          control={form.control}
          name="shiftTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Tipologia turno desiderata{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                {loadingTypes ? (
                  <div
                    className="text-muted-foreground flex items-center gap-2 py-2 text-sm"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Caricamento tipologie…
                  </div>
                ) : (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Seleziona tipologia turno" aria-required="true">
                      <SelectValue placeholder="Seleziona la tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      {(shiftTypes ?? [])
                        .filter((t) => t.active)
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: t.color }}
                                aria-hidden="true"
                              />
                              {t.name}{' '}
                              <span className="text-muted-foreground text-xs">
                                ({t.defaultStartTime}–{t.defaultEndTime})
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Note */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Note <span className="text-xs font-normal text-gray-400">(facoltative)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Motivazione o disponibilità oraria aggiuntiva..."
                  rows={3}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Azioni */}
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Indietro
          </Button>
          <Button type="submit" data-testid="new-shift-form-next-btn">
            Avanti
          </Button>
        </div>
      </form>
    </Form>
  );
}
