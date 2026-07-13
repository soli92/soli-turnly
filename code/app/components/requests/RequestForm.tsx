'use client';

/**
 * components/requests/RequestForm.tsx — Form multi-step richiesta dipendente.
 *
 * Step 1: selezione tipo richiesta (4 card radio):
 *   - Assenza
 *   - Scambio turno
 *   - Nuovo turno
 *   - Modifica turno
 *
 * Step 2: form dinamico per tipo selezionato:
 *   - Assenza: tipo (Select) + startDate + endDate
 *   - Scambio: selezione turno collega (lista turni disponibili, stessa fascia)
 *   - Nuovo turno: data + tipologia
 *   - Modifica turno: turnoId + descrizione modifica
 *
 * Schema: requestCreateSchema da @/lib/zod.
 * Submit → POST /api/requests
 *
 * data-testid: request-form, request-type-radio-{type}, submit-btn
 *
 * Accessibility: WCAG 2.2 AA
 * - Radio buttons con label visibili e aria-describedby
 * - Step progress comunicato via aria-label
 * - Errori con role="alert" + aria-live="polite"
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, ArrowLeftRight, Plus, Edit3 } from 'lucide-react';

import { requestCreateSchema, type RequestCreateInput } from '@/lib/zod';
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
import { cn } from '@/lib/utils';
import { useCreateRequest } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Tipo selezionabile (unione delle opzioni del form)
// ---------------------------------------------------------------------------

type RequestTypeOption = RequestCreateInput['type'];

// ---------------------------------------------------------------------------
// Configurazione card step 1
// ---------------------------------------------------------------------------

const REQUEST_TYPE_OPTIONS: {
  value: RequestTypeOption;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: 'absence',
    label: 'Assenza',
    description: 'Ferie, malattia, permesso o altra assenza',
    Icon: Calendar,
  },
  {
    value: 'shift_swap',
    label: 'Scambio turno',
    description: 'Proponi uno scambio con un collega',
    Icon: ArrowLeftRight,
  },
  {
    value: 'new_shift',
    label: 'Nuovo turno',
    description: 'Richiedi di essere aggiunto a un turno',
    Icon: Plus,
  },
  {
    value: 'modify_shift',
    label: 'Modifica turno',
    description: 'Proponi una modifica a un turno esistente',
    Icon: Edit3,
  },
];

const ABSENCE_TYPES = [
  { value: 'ferie', label: 'Ferie' },
  { value: 'malattia', label: 'Malattia' },
  { value: 'permesso', label: 'Permesso' },
  { value: 'maternita-paternita', label: 'Maternità/Paternità' },
  { value: 'altro', label: 'Altro' },
];

// ---------------------------------------------------------------------------
// Turno disponibile per scambio
// ---------------------------------------------------------------------------

interface AvailableShift {
  id: string;
  label: string;
  userId: string;
  userName: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestFormProps {
  /** Turni disponibili per scambio (stessa fascia). Richiesti solo per shift_swap. */
  availableShifts?: AvailableShift[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Step 1 — Selezione tipo
// ---------------------------------------------------------------------------

function StepTypeSelection({
  selected,
  onSelect,
}: {
  selected: RequestTypeOption | null;
  onSelect: (v: RequestTypeOption) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-gray-700 mb-3">
        Seleziona il tipo di richiesta
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REQUEST_TYPE_OPTIONS.map(({ value, label, description, Icon }) => (
          <label
            key={value}
            data-testid={`request-type-radio-${value}`}
            className={cn(
              'relative flex cursor-pointer rounded-lg border p-4 gap-3 items-start',
              'focus-within:ring-2 focus-within:ring-ring transition-colors',
              selected === value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-gray-400 bg-white',
            )}
          >
            <input
              type="radio"
              name="requestType"
              value={value}
              checked={selected === value}
              onChange={() => onSelect(value)}
              className="sr-only"
              aria-describedby={`desc-${value}`}
            />
            <Icon
              className={cn(
                'h-5 w-5 mt-0.5 shrink-0',
                selected === value ? 'text-primary' : 'text-gray-400',
              )}
              aria-hidden="true"
            />
            <div>
              <span
                className={cn(
                  'block text-sm font-medium',
                  selected === value ? 'text-primary' : 'text-gray-900',
                )}
              >
                {label}
              </span>
              <span
                id={`desc-${value}`}
                className="block text-xs text-gray-500 mt-0.5"
              >
                {description}
              </span>
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Form dinamico per tipo
// ---------------------------------------------------------------------------

function StepAbsence({
  form,
}: {
  form: ReturnType<typeof useForm<RequestCreateInput>>;
}) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="payload.absenceType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo di assenza</FormLabel>
            <FormControl>
              <Select
                value={(field.value as string) ?? ''}
                onValueChange={field.onChange}
              >
                <SelectTrigger aria-label="Seleziona tipo di assenza">
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
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="payload.startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data inizio</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  aria-required="true"
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="payload.endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data fine</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  aria-required="true"
                  {...field}
                  value={(field.value as string) ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

function StepShiftSwap({
  form,
  availableShifts,
}: {
  form: ReturnType<typeof useForm<RequestCreateInput>>;
  availableShifts: AvailableShift[];
}) {
  return (
    <FormField
      control={form.control}
      name="payload.targetShiftId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Turno del collega</FormLabel>
          <FormControl>
            <Select
              value={(field.value as string) ?? ''}
              onValueChange={field.onChange}
            >
              <SelectTrigger aria-label="Seleziona turno collega">
                <SelectValue placeholder="Seleziona un turno disponibile" />
              </SelectTrigger>
              <SelectContent>
                {availableShifts.length === 0 ? (
                  <SelectItem value="" disabled>
                    Nessun turno disponibile per lo scambio
                  </SelectItem>
                ) : (
                  availableShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} — {s.userName}
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
  );
}

function StepNewShift({
  form,
}: {
  form: ReturnType<typeof useForm<RequestCreateInput>>;
}) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="payload.date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Data turno richiesto</FormLabel>
            <FormControl>
              <Input
                type="date"
                aria-required="true"
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="payload.shiftType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tipologia turno</FormLabel>
            <FormControl>
              <Input
                placeholder="Es. Mattina, Pomeriggio, Notte..."
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function StepModifyShift({
  form,
}: {
  form: ReturnType<typeof useForm<RequestCreateInput>>;
}) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="payload.shiftId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>ID turno da modificare</FormLabel>
            <FormControl>
              <Input
                placeholder="ID del turno esistente"
                aria-required="true"
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="payload.proposedChange"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Modifica proposta</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Descrivi la modifica che vuoi apportare al turno..."
                rows={3}
                {...field}
                value={(field.value as string) ?? ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

export function RequestForm({
  availableShifts = [],
  onSuccess,
  onCancel,
}: RequestFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<RequestTypeOption | null>(null);

  const form = useForm<RequestCreateInput>({
    resolver: zodResolver(requestCreateSchema),
    defaultValues: {
      type: undefined,
      payload: {},
    },
  });

  const mutation = useCreateRequest();

  function handleTypeSelect(type: RequestTypeOption) {
    setSelectedType(type);
    form.setValue('type', type);
    form.setValue('payload', {});
  }

  function handleNext() {
    if (!selectedType) {
      return;
    }
    setStep(2);
  }

  function handleBack() {
    setStep(1);
    form.clearErrors();
  }

  function onSubmit(data: RequestCreateInput) {
    mutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setStep(1);
        setSelectedType(null);
        onSuccess?.();
      },
      onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
        err.issues?.forEach((issue) => {
          const path = issue.path.join('.') as keyof RequestCreateInput;
          if (path) {
            form.setError(path, { message: issue.message });
          }
        });
      },
    });
  }

  return (
    <Form {...form}>
      <form
        data-testid="request-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        aria-label="Nuova richiesta"
        noValidate
      >
        {/* Progress indicator */}
        <div
          className="flex items-center gap-2 text-xs text-gray-500"
          aria-label={`Step ${step} di 2`}
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium',
              step >= 1 ? 'bg-primary text-white' : 'bg-gray-200',
            )}
            aria-hidden="true"
          >
            1
          </span>
          <span className={step >= 1 ? 'text-primary font-medium' : ''}>
            Tipo richiesta
          </span>
          <span aria-hidden="true">→</span>
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium',
              step >= 2 ? 'bg-primary text-white' : 'bg-gray-200',
            )}
            aria-hidden="true"
          >
            2
          </span>
          <span className={step >= 2 ? 'text-primary font-medium' : ''}>
            Dettagli
          </span>
        </div>

        {/* Step 1: Selezione tipo */}
        {step === 1 && (
          <StepTypeSelection selected={selectedType} onSelect={handleTypeSelect} />
        )}

        {/* Step 2: Form dinamico */}
        {step === 2 && selectedType && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Compila i dettagli per la richiesta di tipo{' '}
              <span className="font-medium text-gray-900">
                {REQUEST_TYPE_OPTIONS.find((o) => o.value === selectedType)?.label}
              </span>
            </p>

            {selectedType === 'absence' && <StepAbsence form={form} />}
            {selectedType === 'shift_swap' && (
              <StepShiftSwap form={form} availableShifts={availableShifts} />
            )}
            {selectedType === 'new_shift' && <StepNewShift form={form} />}
            {selectedType === 'modify_shift' && <StepModifyShift form={form} />}
          </div>
        )}

        {/* Errore generico */}
        {mutation.isError && (
          <p role="alert" className="text-xs text-destructive">
            {mutation.error?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex justify-between pt-2">
          <div>
            {step === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={mutation.isPending}
              >
                Indietro
              </Button>
            )}
            {onCancel && step === 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={mutation.isPending}
              >
                Annulla
              </Button>
            )}
          </div>

          {step === 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!selectedType}
            >
              Avanti
            </Button>
          ) : (
            <Button
              data-testid="submit-btn"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Invio...' : 'Invia richiesta'}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
