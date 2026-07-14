'use client';

/**
 * components/recurrence/step1-RecurrenceTypeStep.tsx
 *
 * Step 1 del wizard ricorrenze: selezione tipo ricorrenza.
 *
 * Modalità:
 *   - Settimanale: griglia giorni della settimana, ciascuno con
 *     checkbox di abilitazione e select del tipo turno.
 *   - Ciclo rotativo: sequenza ordinata di tipi turno + lunghezza ciclo.
 *
 * Mantiene i dati tramite onComplete callback per il wizard orchestratore.
 *
 * Accessibility: WCAG 2.2 AA
 *   - Fieldset + legend per il gruppo tipo ricorrenza
 *   - aria-required su campi obbligatori
 *   - aria-live="polite" per messaggi di errore
 *   - Keyboard navigabile: focus ring visibile su tutti i controlli
 *
 * TSK-019, RF-E
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useShiftTypes } from '@/hooks/useShiftTypes';

// ---------------------------------------------------------------------------
// Costanti giorni settimana
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

// ---------------------------------------------------------------------------
// Tipi dati Step 1
// ---------------------------------------------------------------------------

export interface Step1Data {
  type: 'weekly' | 'rotating';
  weeklyDays: Array<{ dayOfWeek: number; shiftTypeId: string }>;
  rotatingSequence: string[];
  cycleLength: number;
}

interface Step1Props {
  initialData: Step1Data;
  onComplete: (data: Step1Data) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecurrenceTypeStep({ initialData, onComplete }: Step1Props) {
  const [type, setType] = useState<'weekly' | 'rotating'>(initialData.type);

  // Weekly state: mappa dayOfWeek → shiftTypeId ('' = non configurato)
  const [weeklyMap, setWeeklyMap] = useState<Map<number, string>>(() => {
    const m = new Map<number, string>();
    for (const day of initialData.weeklyDays) {
      m.set(day.dayOfWeek, day.shiftTypeId);
    }
    return m;
  });
  const [enabledDays, setEnabledDays] = useState<Set<number>>(() => {
    return new Set(initialData.weeklyDays.map((d) => d.dayOfWeek));
  });

  // Rotating state
  const [rotatingSequence, setRotatingSequence] = useState<string[]>(initialData.rotatingSequence);
  const [cycleLength, setCycleLength] = useState<number>(
    initialData.cycleLength || initialData.rotatingSequence.length || 3
  );
  const [addingShiftType, setAddingShiftType] = useState<string>('');

  // Errori di validazione
  const [errors, setErrors] = useState<string[]>([]);

  const { data: shiftTypes = [], isLoading: shiftTypesLoading } = useShiftTypes();
  const activeShiftTypes = shiftTypes.filter((st) => st.active);

  // ---------------------------------------------------------------------------
  // Weekly handlers
  // ---------------------------------------------------------------------------

  function toggleDay(dayOfWeek: number) {
    setEnabledDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayOfWeek)) {
        next.delete(dayOfWeek);
        setWeeklyMap((m) => {
          const nm = new Map(m);
          nm.delete(dayOfWeek);
          return nm;
        });
      } else {
        next.add(dayOfWeek);
      }
      return next;
    });
  }

  function setDayShiftType(dayOfWeek: number, shiftTypeId: string) {
    setWeeklyMap((prev) => {
      const next = new Map(prev);
      next.set(dayOfWeek, shiftTypeId);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Rotating handlers
  // ---------------------------------------------------------------------------

  function addToSequence(shiftTypeId: string) {
    if (!shiftTypeId) return;
    setRotatingSequence((prev) => [...prev, shiftTypeId]);
    setCycleLength((prev) => Math.max(prev, rotatingSequence.length + 1));
    setAddingShiftType('');
  }

  function removeFromSequence(index: number) {
    setRotatingSequence((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------------------------------------------------------------------------
  // Validazione e submit
  // ---------------------------------------------------------------------------

  function validate(): Step1Data | null {
    const errs: string[] = [];

    if (type === 'weekly') {
      if (enabledDays.size === 0) {
        errs.push('Seleziona almeno un giorno della settimana.');
      }
      for (const day of enabledDays) {
        const shiftTypeId = weeklyMap.get(day);
        if (!shiftTypeId) {
          const dayLabel = DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? '';
          errs.push(`Seleziona il tipo turno per ${dayLabel}.`);
        }
      }
      if (errs.length > 0) {
        setErrors(errs);
        return null;
      }
      setErrors([]);
      return {
        type: 'weekly',
        weeklyDays: Array.from(enabledDays).map((day) => ({
          dayOfWeek: day,
          shiftTypeId: weeklyMap.get(day)!,
        })),
        rotatingSequence: [],
        cycleLength: 0,
      };
    }

    // rotating
    if (rotatingSequence.length === 0) {
      errs.push('Aggiungi almeno un tipo turno alla sequenza.');
    }
    if (cycleLength < 1) {
      errs.push('La lunghezza del ciclo deve essere almeno 1.');
    }
    if (errs.length > 0) {
      setErrors(errs);
      return null;
    }
    setErrors([]);
    return {
      type: 'rotating',
      weeklyDays: [],
      rotatingSequence,
      cycleLength,
    };
  }

  function handleNext() {
    const data = validate();
    if (data) {
      onComplete(data);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (shiftTypesLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento tipi turno">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border-border h-10 animate-pulse rounded-lg border bg-gray-50" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scelta tipo */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-gray-700">
          Tipo ricorrenza
          <span aria-hidden="true" className="text-destructive ml-1">
            *
          </span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              {
                value: 'weekly',
                label: 'Settimanale',
                desc: 'Stesso turno ogni settimana nei giorni selezionati',
              },
              {
                value: 'rotating',
                label: 'Ciclo rotativo',
                desc: 'Sequenza di tipi turno che si ripete ciclicamente',
              },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`focus-within:ring-ring relative flex cursor-pointer rounded-lg border p-4 text-sm transition-colors focus-within:ring-2 ${
                type === opt.value
                  ? 'border-primary bg-primary/5 text-gray-900'
                  : 'border-border bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="recurrence-type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="sr-only"
                aria-label={opt.label}
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                      type === opt.value ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{opt.label}</span>
                </div>
                <p className="pl-5.5 text-xs leading-relaxed text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Configurazione settimanale */}
      {type === 'weekly' && (
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-gray-700">
            Configura giorni e turni
          </legend>
          <div className="space-y-2">
            {DAYS_OF_WEEK.map(({ value: dayOfWeek, label }) => {
              const isEnabled = enabledDays.has(dayOfWeek);
              const shiftTypeId = weeklyMap.get(dayOfWeek) ?? '';
              return (
                <div
                  key={dayOfWeek}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
                    isEnabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-white'
                  }`}
                >
                  {/* Checkbox giorno */}
                  <label className="flex min-w-[110px] cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleDay(dayOfWeek)}
                      className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
                      aria-label={label}
                    />
                    <span
                      className={`text-sm font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}
                    >
                      {label}
                    </span>
                  </label>

                  {/* Select tipo turno (visibile solo se giorno abilitato) */}
                  {isEnabled && (
                    <div className="flex-1">
                      <Select
                        value={shiftTypeId}
                        onValueChange={(v) => setDayShiftType(dayOfWeek, v)}
                      >
                        <SelectTrigger
                          className="h-8 text-sm"
                          aria-label={`Tipo turno per ${label}`}
                          aria-required="true"
                        >
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
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Configurazione ciclo rotativo */}
      {type === 'rotating' && (
        <div className="space-y-4">
          {/* Sequenza */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">
              Sequenza tipi turno
              <span aria-hidden="true" className="text-destructive ml-1">
                *
              </span>
            </legend>
            <p className="mb-3 text-xs text-gray-500">
              Aggiungi i tipi turno nell&apos;ordine del ciclo (es: Mattina, Notte, Riposo,
              Mattina…). Ogni dipendente inizierà dal suo offset nella sequenza.
            </p>

            {/* Lista sequenza */}
            {rotatingSequence.length > 0 && (
              <ol className="mb-3 space-y-1.5" aria-label="Sequenza turni">
                {rotatingSequence.map((shiftTypeId, idx) => {
                  const st = activeShiftTypes.find((s) => s.id === shiftTypeId);
                  return (
                    <li
                      key={`${shiftTypeId}-${idx}`}
                      className="border-border flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <span className="w-5 shrink-0 text-right font-mono text-xs text-gray-400">
                        {idx + 1}.
                      </span>
                      {st && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: st.color }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex-1 font-medium text-gray-800">
                        {st?.name ?? shiftTypeId}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeFromSequence(idx)}
                        aria-label={`Rimuovi passo ${idx + 1} dalla sequenza`}
                        className="h-7 border-red-200 px-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Aggiungi passo */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={addingShiftType} onValueChange={setAddingShiftType}>
                  <SelectTrigger
                    className="h-9 text-sm"
                    aria-label="Tipo turno da aggiungere alla sequenza"
                  >
                    <SelectValue placeholder="Scegli tipo turno da aggiungere…" />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => addToSequence(addingShiftType)}
                disabled={!addingShiftType}
                aria-label="Aggiungi tipo turno alla sequenza"
                className="h-9"
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                Aggiungi
              </Button>
            </div>
          </fieldset>

          {/* Lunghezza ciclo */}
          <div className="space-y-1.5">
            <Label htmlFor="cycle-length">
              Lunghezza ciclo (giorni)
              <span aria-hidden="true" className="text-destructive ml-1">
                *
              </span>
            </Label>
            <Input
              id="cycle-length"
              type="number"
              min={1}
              max={365}
              value={cycleLength}
              onChange={(e) => setCycleLength(Math.max(1, Number(e.target.value)))}
              className="w-32"
              aria-required="true"
              aria-describedby="cycle-length-hint"
            />
            <p id="cycle-length-hint" className="text-xs text-gray-500">
              Default: lunghezza della sequenza ({rotatingSequence.length} passi). Puoi impostare un
              ciclo più lungo includendo giorni di riposo impliciti.
            </p>
          </div>
        </div>
      )}

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

      {/* Navigazione */}
      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleNext}>
          Avanti: Configurazione
        </Button>
      </div>
    </div>
  );
}
