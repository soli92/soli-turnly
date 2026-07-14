'use client';

/**
 * components/employee/requests/new/RequestFormAbsence.tsx
 *
 * Step 2a del wizard nuova richiesta: form assenza.
 *
 * Campi:
 *   - absenceType: select (ferie | malattia | permesso | maternita-paternita | altro)
 *   - startDate: date picker YYYY-MM-DD
 *   - endDate: date picker YYYY-MM-DD (>= startDate)
 *   - notes: textarea opzionale
 *
 * Validazione Zod:
 *   - absenceType obbligatorio
 *   - startDate, endDate obbligatori e formato YYYY-MM-DD
 *   - endDate >= startDate (errore inline su endDate)
 *
 * Anteprima: "Richiesta di N giorni lavorativi" calcolata client-side.
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-required su i campi obbligatori
 *   - errori con FormMessage
 *   - aria-live="polite" sull'anteprima giorni lavorativi
 *
 * TSK-023
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { differenceInBusinessDays, parseISO, isValid } from 'date-fns';
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

// ---------------------------------------------------------------------------
// Schema e tipo payload
// ---------------------------------------------------------------------------

const ABSENCE_TYPES = [
  { value: 'ferie', label: 'Ferie' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'permesso', label: 'Permesso' },
  { value: 'maternita-paternita', label: 'Maternità/Paternità' },
  { value: 'altro', label: 'Altro' },
] as const;

type AbsenceTypeValue = (typeof ABSENCE_TYPES)[number]['value'];

// Schema base (senza refine) per il tipo del form
const absencePayloadBaseSchema = z.object({
  absenceType: z.enum(['ferie', 'malattia', 'permesso', 'maternita-paternita', 'altro'] as const),
  startDate: z
    .string()
    .min(1, 'Data inizio obbligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
  endDate: z
    .string()
    .min(1, 'Data fine obbligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido'),
  notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional(),
});

// Schema con refine per la validazione submit
export const absencePayloadSchema = absencePayloadBaseSchema.refine(
  (d) => new Date(d.startDate) <= new Date(d.endDate),
  {
    message: 'La data di fine deve essere uguale o successiva alla data di inizio',
    path: ['endDate'],
  }
);

// Il tipo usa lo schema base per evitare inferenza da ZodEffects
export type AbsencePayload = z.infer<typeof absencePayloadBaseSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestFormAbsenceProps {
  defaultValues?: Partial<AbsencePayload>;
  onNext: (data: AbsencePayload) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestFormAbsence({ defaultValues, onNext, onBack }: RequestFormAbsenceProps) {
  const form = useForm<AbsencePayload>({
    resolver: zodResolver(absencePayloadSchema),
    defaultValues: {
      startDate: defaultValues?.startDate ?? '',
      endDate: defaultValues?.endDate ?? '',
      ...(defaultValues?.absenceType !== undefined
        ? ({ absenceType: defaultValues.absenceType } as { absenceType: AbsenceTypeValue })
        : {}),
      ...(defaultValues?.notes !== undefined ? { notes: defaultValues.notes } : {}),
    },
  });

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  // Calcola giorni lavorativi per l'anteprima
  let workingDays: number | null = null;
  if (startDate && endDate) {
    const s = parseISO(startDate);
    const e = parseISO(endDate);
    if (isValid(s) && isValid(e) && s <= e) {
      workingDays = differenceInBusinessDays(e, s) + 1;
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onNext)(e)}
        className="space-y-4"
        noValidate
        aria-label="Dettagli assenza"
      >
        {/* Tipo assenza */}
        <FormField
          control={form.control}
          name="absenceType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Tipo di assenza{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Seleziona tipo di assenza" aria-required="true">
                    <SelectValue placeholder="Seleziona il tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {ABSENCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Data inizio{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FormLabel>
                <FormControl>
                  <Input type="date" aria-required="true" {...field} />
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
                  Data fine{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </FormLabel>
                <FormControl>
                  <Input type="date" aria-required="true" min={startDate || undefined} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Anteprima giorni lavorativi */}
        {workingDays !== null && workingDays > 0 && (
          <p
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700"
            role="status"
            aria-live="polite"
          >
            Richiesta di <span className="font-semibold">{workingDays}</span> giorno
            {workingDays !== 1 ? 'i' : ''} lavorativo
            {workingDays !== 1 ? 'i' : ''}
          </p>
        )}

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
                  placeholder="Motivazione o informazioni aggiuntive per il responsabile..."
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
          <Button type="submit" data-testid="absence-form-next-btn">
            Avanti
          </Button>
        </div>
      </form>
    </Form>
  );
}
