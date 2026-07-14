'use client';

/**
 * components/recurrence/RecurrenceEditForm.tsx
 *
 * Form di modifica per una ricorrenza esistente.
 *
 * Campi modificabili: shiftTypeId, frequency, daysOfWeek, startDate, endDate.
 * userId è immutabile dopo la creazione.
 *
 * On submit: PATCH /api/admin/recurrences/:id → redirect a /admin/recurrence.
 *
 * Riusa i pattern UI (Select, Input, checkbox giorni) dei componenti wizard
 * (step1-RecurrenceTypeStep, step2-RecurrenceSequenceStep).
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-required sui campi obbligatori
 *   - fieldset + legend per gruppi
 *   - role="alert" + aria-live="assertive" per errori
 *   - aria-disabled sul submit durante pending
 *
 * TSK-019, RF-E
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShiftTypes } from '@/hooks/useShiftTypes';
import { usePatchRecurrence, type RecurrenceRow } from '@/hooks/useRecurrences';

// ---------------------------------------------------------------------------
// Costanti
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
] as const;

const FREQ_OPTIONS: Array<{ value: RecurrenceRow['frequency']; label: string }> = [
  { value: 'weekly', label: 'Settimanale' },
  { value: 'biweekly', label: 'Bisettimanale' },
  { value: 'monthly', label: 'Mensile' },
];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface Props {
  recurrence: RecurrenceRow;
}

export function RecurrenceEditForm({ recurrence }: Props) {
  const router = useRouter();
  const { data: shiftTypes = [] } = useShiftTypes();
  const patchMutation = usePatchRecurrence();

  const [shiftTypeId, setShiftTypeId] = useState(recurrence.shiftTypeId);
  const [frequency, setFrequency] = useState<RecurrenceRow['frequency']>(recurrence.frequency);
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(new Set(recurrence.daysOfWeek));
  const [startDate, setStartDate] = useState(recurrence.startDate);
  const [endDate, setEndDate] = useState(recurrence.endDate ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const activeShiftTypes = shiftTypes.filter((st) => st.active);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!shiftTypeId) errs.push('Seleziona un tipo turno.');
    if (daysOfWeek.size === 0) errs.push('Seleziona almeno un giorno della settimana.');
    if (!startDate) errs.push('Inserisci la data di inizio.');
    if (endDate && endDate <= startDate) {
      errs.push('La data di fine deve essere successiva alla data di inizio.');
    }
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    patchMutation.mutate(
      {
        id: recurrence.id,
        patch: {
          shiftTypeId,
          frequency,
          daysOfWeek: Array.from(daysOfWeek),
          startDate,
          endDate: endDate || null,
        },
      },
      { onSuccess: () => router.push('/admin/recurrence') }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-border space-y-6 rounded-lg border bg-white p-6"
    >
      {/* Tipo turno */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-shift-type">
          Tipo turno
          <span aria-hidden="true" className="text-destructive ml-1">
            *
          </span>
        </Label>
        <Select value={shiftTypeId} onValueChange={setShiftTypeId}>
          <SelectTrigger id="edit-shift-type" aria-required="true">
            <SelectValue placeholder="Seleziona tipo turno" />
          </SelectTrigger>
          <SelectContent>
            {activeShiftTypes.map((st) => (
              <SelectItem key={st.id} value={st.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: st.color }}
                    aria-hidden="true"
                  />
                  {st.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Frequenza */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-frequency">Frequenza</Label>
        <Select
          value={frequency}
          onValueChange={(v) => setFrequency(v as RecurrenceRow['frequency'])}
        >
          <SelectTrigger id="edit-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQ_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Giorni della settimana */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-gray-700">
          Giorni della settimana
          <span aria-hidden="true" className="text-destructive ml-1">
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(({ value, label }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                daysOfWeek.has(value)
                  ? 'border-primary bg-primary/5 text-gray-900'
                  : 'border-border bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <input
                type="checkbox"
                checked={daysOfWeek.has(value)}
                onChange={() => toggleDay(value)}
                className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
                aria-label={label}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Intervallo date */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-gray-700">Intervallo date</legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-start-date">
              Data inizio
              <span aria-hidden="true" className="text-destructive ml-1">
                *
              </span>
            </Label>
            <Input
              id="edit-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-required="true"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-end-date">Data fine (opzionale)</Label>
            <Input
              id="edit-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </div>
        </div>
      </fieldset>

      {/* Errori validazione */}
      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <ul className="list-inside list-disc space-y-1" role="list">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Errore API */}
      {patchMutation.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {patchMutation.error instanceof Error
            ? patchMutation.error.message
            : 'Errore nel salvataggio'}
        </div>
      )}

      {/* Azioni */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          type="submit"
          disabled={patchMutation.isPending}
          aria-disabled={patchMutation.isPending}
        >
          {patchMutation.isPending ? 'Salvataggio…' : 'Salva modifiche'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/recurrence')}
          disabled={patchMutation.isPending}
        >
          Annulla
        </Button>
      </div>
    </form>
  );
}
