'use client';

/**
 * components/shift-types/ShiftTypeModal.tsx — Dialog crea/modifica tipologia turno.
 *
 * Modalità:
 *   - create: POST /api/shift-types
 *   - edit:   PATCH /api/shift-types/:id
 *
 * Funzionalità:
 *   - Calcolo live durata turno (RF-C CA1, RB-12 DST-safe via date-fns)
 *   - Rilevamento automatico turni notturni (attraversaMezzanotte: endTime <= startTime)
 *   - Swatch picker colori predefiniti
 *   - Validazione Zod campo per campo in italiano
 *
 * Accessibility: WCAG 2.2 AA
 *   - Focus trap gestito da Radix Dialog
 *   - Tutti i campi con label + aria-required
 *   - FormMessage con role="alert"
 *   - Warning notturno con role="status" e aria-live="polite"
 */

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Moon } from 'lucide-react';
import { differenceInMinutes } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShiftTypeColorPicker } from './ShiftTypeColorPicker';
import {
  useCreateShiftType,
  useUpdateShiftType,
  type ShiftTypeFullRow,
  type ShiftTypeApiError,
} from '@/hooks/useShiftTypes';

// ---------------------------------------------------------------------------
// Schema Zod per il form (crea/modifica) — senza .default() per compatibilità
// con zodResolver in react-hook-form (i default vengono passati via defaultValues)
// ---------------------------------------------------------------------------

const shiftTypeFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Il nome è obbligatorio')
    .max(100, 'Il nome non può superare i 100 caratteri'),
  code: z
    .string()
    .min(1, 'Il codice è obbligatorio')
    .max(20, 'Il codice non può superare i 20 caratteri')
    .regex(/^[A-Z0-9_]+$/, 'Il codice deve contenere solo lettere maiuscole, numeri e underscore'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colore non valido — atteso formato #RRGGBB'),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato orario non valido — atteso HH:MM'),
  defaultEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato orario non valido — atteso HH:MM'),
  breakMinutes: z
    .number()
    .int('I minuti di pausa devono essere un numero intero')
    .min(0, 'I minuti di pausa non possono essere negativi'),
  active: z.boolean(),
});

type ShiftTypeFormValues = z.infer<typeof shiftTypeFormSchema>;

// ---------------------------------------------------------------------------
// Utility: parsing sicuro di HH:MM → { hours, minutes } | null
// ---------------------------------------------------------------------------

function parseHHMM(time: string): { h: number; m: number } | null {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const colonIdx = time.indexOf(':');
  const h = parseInt(time.slice(0, colonIdx), 10);
  const m = parseInt(time.slice(colonIdx + 1), 10);
  if (isNaN(h) || isNaN(m)) return null;
  return { h, m };
}

// ---------------------------------------------------------------------------
// Utility: calcolo durata turno da HH:MM (DST-safe via date-fns)
// Segue RB-12: usa differenceInMinutes che opera in UTC (ms)
// ---------------------------------------------------------------------------

function calcShiftDurationFromTimes(
  startTime: string,
  endTime: string
): { durationMinutes: number; crossesMidnight: boolean } | null {
  const start = parseHHMM(startTime);
  const end = parseHHMM(endTime);
  if (!start || !end) return null;

  // Usa date di riferimento fisse (non DST) per la preview del form
  const ref = new Date(2000, 0, 3, 0, 0, 0);
  const startDt = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), start.h, start.m);
  const endSameDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), end.h, end.m);

  // attraversaMezzanotte = endTime <= startTime (spec RF-C CA1)
  const crossesMidnight = end.h * 60 + end.m <= start.h * 60 + start.m;

  const endDt = crossesMidnight ? new Date(endSameDay.getTime() + 24 * 60 * 60 * 1000) : endSameDay;

  const durationMinutes = differenceInMinutes(endDt, startDt);
  return { durationMinutes, crossesMidnight };
}

/** Formatta minuti → "Xh YYmin" (es. 480 → "8h 00min"). */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShiftTypeModalCreateProps {
  mode: 'create';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShiftTypeModalEditProps {
  mode: 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftType: ShiftTypeFullRow;
}

type ShiftTypeModalProps = ShiftTypeModalCreateProps | ShiftTypeModalEditProps;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ShiftTypeModal(props: ShiftTypeModalProps) {
  const { mode, open, onOpenChange } = props;
  const isEdit = mode === 'edit';

  // Default values per il form
  const defaultValues: ShiftTypeFormValues = isEdit
    ? {
        name: (props as ShiftTypeModalEditProps).shiftType.name,
        code: (props as ShiftTypeModalEditProps).shiftType.code,
        color: (props as ShiftTypeModalEditProps).shiftType.color,
        defaultStartTime: (props as ShiftTypeModalEditProps).shiftType.defaultStartTime.slice(0, 5),
        defaultEndTime: (props as ShiftTypeModalEditProps).shiftType.defaultEndTime.slice(0, 5),
        breakMinutes: (props as ShiftTypeModalEditProps).shiftType.breakMinutes,
        active: (props as ShiftTypeModalEditProps).shiftType.active,
      }
    : {
        name: '',
        code: '',
        color: '#6B7280',
        defaultStartTime: '',
        defaultEndTime: '',
        breakMinutes: 0,
        active: true,
      };

  const form = useForm<ShiftTypeFormValues>({
    resolver: zodResolver(shiftTypeFormSchema),
    defaultValues,
  });

  const createMutation = useCreateShiftType();
  const updateMutation = useUpdateShiftType();

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Valori live per il calcolo durata
  const watchedStart = form.watch('defaultStartTime');
  const watchedEnd = form.watch('defaultEndTime');

  const shiftInfo = useMemo(
    () => calcShiftDurationFromTimes(watchedStart, watchedEnd),
    [watchedStart, watchedEnd]
  );

  function handleClose() {
    form.reset();
    onOpenChange(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) handleClose();
    else onOpenChange(true);
  }

  function applyServerErrors(err: ShiftTypeApiError) {
    err.issues?.forEach((issue) => {
      const field = issue.path[0] as keyof ShiftTypeFormValues | undefined;
      if (field && field in defaultValues) {
        form.setError(field, { message: issue.message });
      }
    });
  }

  function onSubmit(data: ShiftTypeFormValues) {
    // Normalizza code in maiuscolo (già gestito nell'onChange, ma per sicurezza)
    const payload = { ...data, code: data.code.toUpperCase() };

    if (isEdit) {
      updateMutation.mutate(
        { id: (props as ShiftTypeModalEditProps).shiftType.id, data: payload },
        {
          onSuccess: () => handleClose(),
          onError: (err) => applyServerErrors(err),
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => handleClose(),
        onError: (err) => applyServerErrors(err),
      });
    }
  }

  const mutationError = createMutation.error ?? updateMutation.error;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica tipologia turno' : 'Nuova tipologia turno'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Aggiorna i dettagli della tipologia di turno.'
              : 'Inserisci i dettagli della nuova tipologia di turno.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
            className="space-y-4"
            aria-label={isEdit ? 'Modifica tipologia turno' : 'Nuova tipologia turno'}
            noValidate
          >
            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nome{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Es. Turno Notte"
                      aria-required="true"
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Codice */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Codice{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Es. NOTTE"
                      aria-required="true"
                      maxLength={20}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Identificatore breve (lettere maiuscole, numeri, underscore)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Orari: inizio / fine */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="defaultStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Inizio{' '}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="time" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Fine{' '}
                      <span aria-hidden="true" className="text-destructive">
                        *
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Input type="time" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Calcolo durata live */}
            {shiftInfo !== null && (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  shiftInfo.crossesMidnight
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-blue-100 bg-blue-50 text-blue-800'
                }`}
                role="status"
                aria-live="polite"
              >
                {shiftInfo.crossesMidnight && (
                  <div className="mb-1 flex items-center gap-1.5 font-medium">
                    <Moon className="h-4 w-4" aria-hidden="true" />
                    Turno notturno: fine il giorno successivo
                  </div>
                )}
                <div>
                  Durata turno: <strong>{formatDuration(shiftInfo.durationMinutes)}</strong> (
                  {shiftInfo.durationMinutes} minuti)
                </div>
              </div>
            )}

            {/* Pausa */}
            <FormField
              control={form.control}
              name="breakMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pausa (minuti)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      {...field}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Minuti di pausa non retribuiti (default: 0)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Colore */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colore</FormLabel>
                  <FormControl>
                    <ShiftTypeColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormDescription>Colore visualizzato nella griglia turni</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attiva */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="border-border flex flex-row items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-base">Attiva</FormLabel>
                    <FormDescription>
                      Se disattivata, la tipologia non sarà selezionabile per nuovi turni
                    </FormDescription>
                  </div>
                  <FormControl>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={`focus:ring-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
                        field.value ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    >
                      <span className="sr-only">
                        {field.value ? 'Disattiva tipologia' : 'Attiva tipologia'}
                      </span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                          field.value ? 'translate-x-5' : 'translate-x-0'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Errore generico mutation */}
            {mutationError && (
              <p role="alert" className="text-destructive text-xs">
                {mutationError.message ?? 'Si è verificato un errore'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEdit
                    ? 'Salvataggio...'
                    : 'Creazione...'
                  : isEdit
                    ? 'Salva modifiche'
                    : 'Crea tipologia'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
