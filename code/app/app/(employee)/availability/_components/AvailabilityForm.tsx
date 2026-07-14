'use client';

/**
 * app/(employee)/availability/_components/AvailabilityForm.tsx (TSK-025)
 *
 * Form crea disponibilità con:
 *   - Tipo: available | unavailable | preference
 *   - Scope: recurring | date_range
 *   - Definition condizionale in base al scope selezionato
 *     - recurring:  giorno della settimana, startTime, endTime
 *     - date_range: startDate, endDate, startTime? endTime?
 *   - Note opzionali (max 500 caratteri)
 *
 * Validazione client: Zod via react-hook-form (stesso schema del BE).
 * Validation: endDate >= startDate per scope=date_range (inline error).
 *
 * Accessibility: WCAG 2.2 AA
 *   - Tutti i campi hanno FormLabel (htmlFor associato)
 *   - FormMessage rende errori con role="alert" (via shadcn Form)
 *   - Bottone submit con aria-busy durante mutation
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

import { useCreateAvailability } from '@/hooks/useAvailability';
import { availabilityBaseSchema } from '@/lib/zod';
import type { AvailabilityCreateInput } from '@/lib/zod';

// ---------------------------------------------------------------------------
// Schema locale — estende availabilityBaseSchema (type, scope, notes condivisi)
// con i campi flat per il rendering condizionale del form.
// ---------------------------------------------------------------------------

const availabilityFormSchema = availabilityBaseSchema
  .extend({
    // Recurring fields — il coerce viene eseguito manualmente nell'onChange
    dayOfWeek: z.number().int().min(0, 'Giorno non valido').max(6, 'Giorno non valido').optional(),
    recurringStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato HH:MM')
      .optional(),
    recurringEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato HH:MM')
      .optional(),
    // Date range fields
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    dateStartTime: z.string().optional(),
    dateEndTime: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.scope === 'recurring') {
      if (d.dayOfWeek === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Seleziona il giorno della settimana',
          path: ['dayOfWeek'],
        });
      }
      if (!d.recurringStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "L'orario di inizio è obbligatorio",
          path: ['recurringStartTime'],
        });
      }
      if (!d.recurringEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "L'orario di fine è obbligatorio",
          path: ['recurringEndTime'],
        });
      }
    }

    if (d.scope === 'date_range') {
      if (!d.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La data di inizio è obbligatoria',
          path: ['startDate'],
        });
      }
      if (!d.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La data di fine è obbligatoria',
          path: ['endDate'],
        });
      }
      if (d.startDate && d.endDate && new Date(d.endDate) < new Date(d.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La data di fine deve essere uguale o successiva alla data di inizio',
          path: ['endDate'],
        });
      }
    }
  });

type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;

// ---------------------------------------------------------------------------
// Opzioni statiche
// ---------------------------------------------------------------------------

const TYPE_OPTIONS = [
  { value: 'available', label: 'Disponibile' },
  { value: 'unavailable', label: 'Non disponibile' },
  { value: 'preference', label: 'Preferenza' },
] as const;

const SCOPE_OPTIONS = [
  { value: 'recurring', label: 'Ricorrente (settimanale)' },
  { value: 'date_range', label: 'Intervallo di date' },
] as const;

const DAY_OPTIONS = [
  { value: 0, label: 'Domenica' },
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
] as const;

// ---------------------------------------------------------------------------
// Helper: costruisce il payload AvailabilityCreateInput dai valori del form
// ---------------------------------------------------------------------------

function buildPayload(values: AvailabilityFormValues): AvailabilityCreateInput {
  if (values.scope === 'recurring') {
    return {
      type: values.type,
      scope: 'recurring',
      definition: {
        dayOfWeek: values.dayOfWeek!,
        startTime: values.recurringStartTime!,
        endTime: values.recurringEndTime!,
      },
      notes: values.notes ?? null,
    };
  }

  return {
    type: values.type,
    scope: 'date_range',
    definition: {
      startDate: values.startDate!,
      endDate: values.endDate!,
      ...(values.dateStartTime ? { startTime: values.dateStartTime } : {}),
      ...(values.dateEndTime ? { endTime: values.dateEndTime } : {}),
    },
    notes: values.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// Valori di default per reset (senza campi undefined — exactOptionalPropertyTypes)
// ---------------------------------------------------------------------------

const DEFAULT_VALUES: AvailabilityFormValues = {
  type: 'available',
  scope: 'recurring',
  recurringStartTime: '',
  recurringEndTime: '',
  startDate: '',
  endDate: '',
  dateStartTime: '',
  dateEndTime: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AvailabilityForm() {
  const [scope, setScope] = useState<'recurring' | 'date_range'>('recurring');
  const createAvailability = useCreateAvailability();

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function onSubmit(values: AvailabilityFormValues) {
    const payload = buildPayload(values);
    try {
      await createAvailability.mutateAsync(payload);
      form.reset({ ...DEFAULT_VALUES, scope: values.scope });
    } catch (err) {
      const error = err as Error & { issues?: Array<{ path: string[]; message: string }> };
      error.issues?.forEach((issue) => {
        const fieldName = issue.path[0] as keyof AvailabilityFormValues;
        if (fieldName) {
          form.setError(fieldName, { message: issue.message });
        }
      });
    }
  }

  const isSubmitting = createAvailability.isPending;

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="space-y-4"
        aria-label="Aggiungi finestra di disponibilità"
        noValidate
      >
        {/* Riga tipo + scope */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Tipo */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Tipo <span aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger aria-label="Seleziona tipo di disponibilità">
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Scope */}
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Scope <span aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setScope(val as 'recurring' | 'date_range');
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger aria-label="Seleziona scope disponibilità">
                      <SelectValue placeholder="Seleziona scope" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Campi condizionali: recurring */}
        {scope === 'recurring' && (
          <fieldset className="border-border space-y-4 rounded-md border p-4">
            <legend className="px-1 text-xs font-medium text-gray-500">
              Definizione ricorrente
            </legend>

            {/* Giorno della settimana */}
            <FormField
              control={form.control}
              name="dayOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Giorno della settimana <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Select
                      value={field.value !== undefined ? String(field.value) : ''}
                      onValueChange={(val) => field.onChange(Number(val))}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger aria-label="Seleziona giorno della settimana">
                        <SelectValue placeholder="Seleziona giorno" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fascia oraria */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="recurringStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Orario inizio <span aria-hidden="true">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="time" aria-required="true" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recurringEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Orario fine <span aria-hidden="true">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="time" aria-required="true" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>
        )}

        {/* Campi condizionali: date_range */}
        {scope === 'date_range' && (
          <fieldset className="border-border space-y-4 rounded-md border p-4">
            <legend className="px-1 text-xs font-medium text-gray-500">
              Definizione intervallo date
            </legend>

            {/* Date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data inizio <span aria-hidden="true">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" aria-required="true" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Data fine <span aria-hidden="true">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" aria-required="true" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Orari opzionali */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dateStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orario inizio (opzionale)</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orario fine (opzionale)</FormLabel>
                    <FormControl>
                      <Input type="time" disabled={isSubmitting} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>
        )}

        {/* Note */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (opzionale)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Note aggiuntive sulla disponibilità…"
                  rows={2}
                  disabled={isSubmitting}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Errore generico mutation */}
        {createAvailability.isError && (
          <p role="alert" className="text-destructive text-xs">
            {createAvailability.error?.message ??
              'Si è verificato un errore durante il salvataggio'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Salvataggio…' : 'Aggiungi disponibilità'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
