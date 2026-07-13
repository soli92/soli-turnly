'use client';

/**
 * components/requests/SwapForm.tsx — Form scambio turno (admin direct swap).
 *
 * Seleziona turno A (dipendente) e turno B (collega).
 * Mostra anteprima impatto (warning da validateSwap — stub).
 * Submit → POST /api/admin/swap
 *
 * Schema: swapCreateSchema da @/lib/zod (shiftIdA !== shiftIdB).
 *
 * Accessibility: WCAG 2.2 AA
 * - Select con aria-label esplicite
 * - Warnings con role="alert"
 * - Bottone disabilitato durante la mutation
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { swapCreateSchema, type SwapCreateInput } from '@/lib/zod';
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
import type { ShiftRow } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SwapFormProps {
  /** Turni disponibili per lo scambio (tutti i turni pianificati). */
  shifts: ShiftRow[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShiftLabel(shift: ShiftRow): string {
  const date = new Date(shift.startDt).toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
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

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SwapForm({ shifts, onSuccess, onCancel }: SwapFormProps) {
  const queryClient = useQueryClient();
  const [swapWarnings, setSwapWarnings] = useState<string[]>([]);

  const form = useForm<SwapCreateInput>({
    resolver: zodResolver(swapCreateSchema),
    defaultValues: {
      shiftIdA: '',
      shiftIdB: '',
      notes: '',
    },
  });

  const shiftIdA = form.watch('shiftIdA');
  const shiftIdB = form.watch('shiftIdB');

  // Stub: in TSK-010+ sarà una chiamata a validateSwap sul BE
  // Quando entrambi i turni sono selezionati, mostra preview impatto
  const shiftsForB = shifts.filter((s) => s.id !== shiftIdA);

  const mutation = useMutation({
    mutationFn: async (data: SwapCreateInput) => {
      const res = await fetch('/api/admin/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
          warnings?: string[];
        };
        // Mostra warnings se presenti (non bloccanti)
        if (body.warnings?.length) {
          setSwapWarnings(body.warnings);
        }
        const err = new Error(body.error ?? `Errore ${res.status}`) as Error & {
          issues?: Array<{ path: string[]; message: string }>;
        };
        err.issues = body.issues;
        throw err;
      }
      const result = await res.json() as { warnings?: string[] };
      if (result.warnings?.length) {
        setSwapWarnings(result.warnings);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      form.reset();
      setSwapWarnings([]);
      onSuccess?.();
    },
    onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
      err.issues?.forEach((issue) => {
        const fieldName = issue.path[0] as keyof SwapCreateInput;
        if (fieldName) {
          form.setError(fieldName, { message: issue.message });
        }
      });
    },
  });

  function onSubmit(data: SwapCreateInput) {
    setSwapWarnings([]);
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        aria-label="Scambio turno"
        noValidate
      >
        {/* Turno A */}
        <FormField
          control={form.control}
          name="shiftIdA"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turno A</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    // Reset turno B se uguale ad A
                    if (v === shiftIdB) form.setValue('shiftIdB', '');
                  }}
                >
                  <SelectTrigger aria-label="Seleziona turno A">
                    <SelectValue placeholder="Seleziona il primo turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatShiftLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Turno B */}
        <FormField
          control={form.control}
          name="shiftIdB"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turno B (collega)</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!shiftIdA}
                >
                  <SelectTrigger aria-label="Seleziona turno B">
                    <SelectValue placeholder={shiftIdA ? 'Seleziona il secondo turno' : 'Prima seleziona il turno A'} />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftsForB.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatShiftLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Anteprima impatto (warnings) */}
        {swapWarnings.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              <p className="text-sm font-medium text-amber-800">
                Avvisi impatto scambio
              </p>
            </div>
            <ul className="space-y-1 pl-6 list-disc">
              {swapWarnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-700">
                  {w}
                </li>
              ))}
            </ul>
          </div>
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
                  placeholder="Note aggiuntive sullo scambio..."
                  rows={2}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Errore generico */}
        {mutation.isError && (
          <p role="alert" className="text-xs text-destructive">
            {mutation.error?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex gap-3 justify-end pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              Annulla
            </Button>
          )}
          <Button
            type="submit"
            disabled={mutation.isPending || !shiftIdA || !shiftIdB}
          >
            {mutation.isPending ? 'Scambio in corso...' : 'Scambia turni'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
