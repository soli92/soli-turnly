'use client';

/**
 * components/employee/requests/new/RequestFormSwap.tsx
 *
 * Step 2b del wizard nuova richiesta: scambio turno.
 *
 * Flusso:
 *   1. Seleziona il turno proprio da cedere (da useMyFutureShifts)
 *   2. Seleziona il turno del collega da ricevere (ColleagueTurnPicker)
 *   3. Preview impatto RB-10 ottimistico (client-side, overlap check)
 *   4. Note facoltative
 *
 * Nota (F7): il collega deve accettare prima dell'approvazione admin.
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-required sui campi obbligatori
 *   - role="alert" sul banner di warning ottimistico
 *   - aria-live="polite" per i messaggi di stato
 *
 * TSK-023
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { areIntervalsOverlapping } from 'date-fns';
import { AlertTriangle, Loader2, ArrowLeftRight } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColleagueTurnPicker } from './ColleagueTurnPicker';
import { useMyFutureShifts, useAvailableSwapShifts } from '@/hooks/useShifts';
import type { ShiftRow } from '@/types';

// ---------------------------------------------------------------------------
// Schema e tipo payload
// ---------------------------------------------------------------------------

export const swapPayloadSchema = z.object({
  myShiftId: z.string().uuid('Seleziona il tuo turno da cedere'),
  targetShiftId: z.string().uuid('Seleziona il turno del collega'),
  notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional(),
});

export type SwapPayload = z.infer<typeof swapPayloadSchema>;

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
 * Controllo ottimistico RB-10: verifica che il turno ricevuto non si sovrapponga
 * con i turni esistenti del dipendente (escludendo il turno ceduto).
 */
function checkOptimisticOverlap(
  myShifts: ShiftRow[],
  myShiftId: string,
  targetShift: ShiftRow
): string[] {
  const conflicts: string[] = [];
  const targetStart = new Date(targetShift.startDt);
  const targetEnd = new Date(targetShift.endDt);

  const otherShifts = myShifts.filter((s) => s.id !== myShiftId && s.status !== 'cancelled');

  for (const shift of otherShifts) {
    const shiftStart = new Date(shift.startDt);
    const shiftEnd = new Date(shift.endDt);

    if (
      areIntervalsOverlapping(
        { start: targetStart, end: targetEnd },
        { start: shiftStart, end: shiftEnd },
        { inclusive: false }
      )
    ) {
      conflicts.push(
        `Sovrapposizione con il tuo turno del ${new Date(shift.startDt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${new Date(shift.startDt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}–${new Date(shift.endDt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
      );
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestFormSwapProps {
  defaultValues?: Partial<SwapPayload>;
  /** Se navigato dal calendario con ?shiftId=, pre-seleziona il turno */
  defaultMyShiftId?: string;
  onNext: (data: SwapPayload) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestFormSwap({
  defaultValues,
  defaultMyShiftId,
  onNext,
  onBack,
}: RequestFormSwapProps) {
  const { data: myShifts, isLoading: loadingMyShifts } = useMyFutureShifts();
  const { data: availableShifts } = useAvailableSwapShifts();

  const form = useForm<SwapPayload>({
    resolver: zodResolver(swapPayloadSchema),
    defaultValues: {
      myShiftId: defaultMyShiftId ?? '',
      targetShiftId: '',
      notes: '',
      ...defaultValues,
    },
  });

  const myShiftId = form.watch('myShiftId');
  const targetShiftId = form.watch('targetShiftId');

  // Calcola preview ottimistico RB-10
  const targetShift = (availableShifts ?? []).find((s) => s.id === targetShiftId);
  const myShift = (myShifts ?? []).find((s) => s.id === myShiftId);

  const optimisticWarnings =
    myShifts && targetShift && myShiftId
      ? checkOptimisticOverlap(myShifts, myShiftId, targetShift)
      : [];

  if (loadingMyShifts) {
    return (
      <div
        className="text-muted-foreground flex items-center gap-2 py-4 text-sm"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Caricamento turni…
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onNext)(e)}
        className="space-y-5"
        noValidate
        aria-label="Dettagli scambio turno"
      >
        {/* Turno proprio da cedere */}
        <FormField
          control={form.control}
          name="myShiftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Il tuo turno da cedere{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Reset turno collega se stesso shift (impossibile, ma sicurezza)
                    if (v === form.getValues('targetShiftId')) {
                      form.setValue('targetShiftId', '');
                    }
                  }}
                >
                  <SelectTrigger aria-label="Seleziona il tuo turno da cedere" aria-required="true">
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

        {/* Turno del collega (ColleagueTurnPicker) */}
        <FormField
          control={form.control}
          name="targetShiftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Turno del collega da ricevere{' '}
                <span aria-hidden="true" className="text-destructive">
                  *
                </span>
              </FormLabel>
              <FormControl>
                <ColleagueTurnPicker
                  value={field.value}
                  onChange={field.onChange}
                  {...(myShiftId ? { excludeShiftId: myShiftId } : {})}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preview impatto RB-10 ottimistico */}
        {myShift && targetShift && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <p className="text-xs font-medium text-gray-700">Anteprima scambio (ottimistico)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <p className="mb-0.5 text-[10px] tracking-wide text-gray-400 uppercase">Cedi</p>
                <p className="font-medium">{formatShiftLabel(myShift)}</p>
              </div>
              <div>
                <p className="mb-0.5 text-[10px] tracking-wide text-gray-400 uppercase">Ricevi</p>
                <p className="font-medium">{formatShiftLabel(targetShift)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Warning conflitti ottimistici RB-10 */}
        {optimisticWarnings.length > 0 && (
          <div
            role="alert"
            className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <p className="text-xs font-medium text-amber-800">
                Possibili conflitti rilevati (RB-10)
              </p>
            </div>
            <ul className="list-disc space-y-0.5 pl-5">
              {optimisticWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {w}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-600 italic">
              La validazione finale avviene lato server prima dell&apos;approvazione.
            </p>
          </div>
        )}

        {/* Nota F7: collega deve accettare */}
        <p className="text-muted-foreground text-xs italic">
          Il collega dovrà accettare la proposta prima che l&apos;admin possa approvarla (F7).
        </p>

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
                  placeholder="Motivazione per lo scambio..."
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
          <Button type="submit" data-testid="swap-form-next-btn">
            Avanti
          </Button>
        </div>
      </form>
    </Form>
  );
}
