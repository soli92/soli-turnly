'use client';

/**
 * components/employee/requests/new/RequestFormModifyShift.tsx
 *
 * Step 2d del wizard nuova richiesta: modifica turno.
 *
 * Flusso:
 *   1. Seleziona il turno da modificare (da useMyFutureShifts)
 *   2. Specifica la proposta di modifica:
 *      - Nuovo orario start (HH:MM) — opzionale
 *      - Nuovo orario end (HH:MM) — opzionale
 *      - Nuova tipologia turno (select) — opzionale
 *      - Descrizione testuale del cambio richiesto
 *
 * Preview impatto client-side (RB-01..08 ottimistico):
 *   - Verifica che il nuovo orario non si sovrapponga con altri turni propri
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-required sui campi obbligatori
 *   - role="alert" sui warning ottimistici
 *
 * TSK-023
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { areIntervalsOverlapping } from 'date-fns';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { useMyFutureShifts } from '@/hooks/useShifts';
import { useShiftTypes } from '@/hooks/useShiftTypes';
import type { ShiftRow } from '@/types';

// ---------------------------------------------------------------------------
// Schema e tipo payload
// ---------------------------------------------------------------------------

export const modifyShiftPayloadSchema = z
  .object({
    shiftId: z.string().uuid('Seleziona il turno da modificare'),
    proposedStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato orario non valido (HH:MM)')
      .optional()
      .or(z.literal('')),
    proposedEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato orario non valido (HH:MM)')
      .optional()
      .or(z.literal('')),
    proposedShiftTypeId: z.string().optional(),
    proposedChange: z
      .string()
      .max(1000, 'Descrizione troppo lunga (max 1000 caratteri)')
      .optional(),
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional(),
  })
  .refine(
    (d) => {
      if (d.proposedStartTime && d.proposedEndTime) {
        return d.proposedStartTime < d.proposedEndTime;
      }
      return true;
    },
    {
      message: "L'orario di fine deve essere successivo all'orario di inizio",
      path: ['proposedEndTime'],
    }
  )
  .refine(
    (d) => d.proposedStartTime || d.proposedEndTime || d.proposedShiftTypeId || d.proposedChange,
    {
      message: 'Specifica almeno una modifica (orario, tipologia o descrizione)',
      path: ['proposedChange'],
    }
  );

export type ModifyShiftPayload = z.infer<typeof modifyShiftPayloadSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShiftLabel(shift: ShiftRow): string {
  const date = new Date(shift.startDt).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startTime = new Date(shift.startDt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(shift.endDt).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const type = shift.shiftTypeName ?? shift.shiftTypeCode ?? '';
  return `${date} ${startTime}–${endTime}${type ? ` (${type})` : ''}`;
}

/**
 * Controllo ottimistico overlap per la proposta di modifica orario.
 * Usa la data del turno selezionato e i nuovi orari proposti.
 */
function checkProposedOverlap(
  myShifts: ShiftRow[],
  selectedShift: ShiftRow,
  proposedStart: string,
  proposedEnd: string
): string[] {
  const dateStr = selectedShift.date; // YYYY-MM-DD
  const [sy, sm, sd] = dateStr.split('-').map(Number);
  const [sh, smin] = proposedStart.split(':').map(Number);
  const [eh, emin] = proposedEnd.split(':').map(Number);

  const newStart = new Date(sy!, sm! - 1, sd!, sh, smin);
  const newEnd = new Date(sy!, sm! - 1, sd!, eh, emin);

  if (newEnd <= newStart) return [];

  const conflicts: string[] = [];
  const otherShifts = myShifts.filter((s) => s.id !== selectedShift.id && s.status !== 'cancelled');

  for (const shift of otherShifts) {
    if (
      areIntervalsOverlapping(
        { start: newStart, end: newEnd },
        { start: new Date(shift.startDt), end: new Date(shift.endDt) },
        { inclusive: false }
      )
    ) {
      conflicts.push(
        `Sovrapposizione con turno del ${new Date(shift.startDt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} ${new Date(shift.startDt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.endDt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
      );
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestFormModifyShiftProps {
  defaultValues?: Partial<ModifyShiftPayload>;
  /** Se navigato dal calendario con ?shiftId=, pre-seleziona il turno */
  defaultShiftId?: string;
  onNext: (data: ModifyShiftPayload) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestFormModifyShift({
  defaultValues,
  defaultShiftId,
  onNext,
  onBack,
}: RequestFormModifyShiftProps) {
  const { data: myShifts, isLoading: loadingShifts } = useMyFutureShifts();
  const { data: shiftTypes, isLoading: loadingTypes } = useShiftTypes();

  const form = useForm<ModifyShiftPayload>({
    resolver: zodResolver(modifyShiftPayloadSchema),
    defaultValues: {
      shiftId: defaultShiftId ?? '',
      proposedStartTime: '',
      proposedEndTime: '',
      proposedShiftTypeId: '',
      proposedChange: '',
      notes: '',
      ...defaultValues,
    },
  });

  const shiftId = form.watch('shiftId');
  const proposedStartTime = form.watch('proposedStartTime');
  const proposedEndTime = form.watch('proposedEndTime');

  const selectedShift = (myShifts ?? []).find((s) => s.id === shiftId);

  // Calcola overlap ottimistico se si propone un nuovo orario
  const optimisticWarnings =
    myShifts && selectedShift && proposedStartTime && proposedEndTime
      ? checkProposedOverlap(myShifts, selectedShift, proposedStartTime, proposedEndTime)
      : [];

  const isLoading = loadingShifts || loadingTypes;

  if (isLoading) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-2 py-4 text-sm"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Caricamento…
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onNext)(e)}
        className="space-y-4"
        noValidate
        aria-label="Dettagli modifica turno"
      >
        {/* Selezione turno da modificare */}
        <FormField
          control={form.control}
          name="shiftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Turno da modificare{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Seleziona il turno da modificare" aria-required="true">
                    <SelectValue placeholder="Seleziona il turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {(myShifts ?? []).length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Nessun turno futuro disponibile
                      </SelectItem>
                    ) : (
                      (myShifts ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {formatShiftLabel(s)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preview turno selezionato */}
        {selectedShift && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <p className="mb-0.5 font-medium text-gray-700">Turno attuale:</p>
            <p>{formatShiftLabel(selectedShift)}</p>
            {selectedShift.notes && (
              <p className="mt-0.5 text-gray-400 italic">Note: {selectedShift.notes}</p>
            )}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-xs font-medium text-gray-700">
            Proposta di modifica{' '}
            <span className="font-normal text-gray-400">(compila almeno un campo)</span>
          </p>

          {/* Nuovo orario */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="proposedStartTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuovo orario inizio</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="proposedEndTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nuovo orario fine</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Warning overlap ottimistico */}
          {optimisticWarnings.length > 0 && (
            <div
              role="alert"
              className="mt-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <p className="text-xs font-medium text-amber-800">
                  Possibili conflitti di orario (ottimistico)
                </p>
              </div>
              <ul className="list-disc space-y-0.5 pl-5">
                {optimisticWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-700">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Nuova tipologia */}
          <FormField
            control={form.control}
            name="proposedShiftTypeId"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Nuova tipologia turno</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger aria-label="Seleziona nuova tipologia turno">
                      <SelectValue placeholder="Nessun cambio tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessun cambio</SelectItem>
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
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrizione testuale */}
          <FormField
            control={form.control}
            name="proposedChange"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Descrizione della modifica richiesta</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Descrivi in dettaglio la modifica che vorresti apportare al turno..."
                    rows={3}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                  placeholder="Ulteriori informazioni per il responsabile..."
                  rows={2}
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
          <Button type="submit" data-testid="modify-shift-form-next-btn">
            Avanti
          </Button>
        </div>
      </form>
    </Form>
  );
}
