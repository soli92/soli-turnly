'use client';

/**
 * app/(employee)/requests/new/page.tsx — Wizard nuova richiesta (CSR).
 *
 * 3 step:
 *   Step 1 — Selezione tipo (RequestTypeSelector)
 *   Step 2 — Form dinamico per tipo (Absence | Swap | NewShift | ModifyShift)
 *   Step 3 — Riepilogo + invio (RequestReviewStep)
 *
 * Query params in ingresso:
 *   ?type=<RequestType>     → pre-seleziona il tipo e salta step 1
 *   ?shiftId=<UUID>         → pre-popola il shiftId nel form step 2
 *                             (usato da ShiftDetailActions nel calendario)
 *
 * On success: redirect a /requests (lista richieste dipendente)
 * On 400 Zod errors: torna step 2 con gli errori mappati ai campi
 *
 * Accessibility: WCAG 2.2 AA
 *   - Stepper con aria-current="step" sull'elemento attivo
 *   - Focus sul titolo del passo corrente a ogni avanzamento (useRef)
 *   - aria-label="Procedura guidata nuova richiesta" sul wrapper
 *
 * TSK-023
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { RequestTypeSelector } from '@/components/employee/requests/new/RequestTypeSelector';
import {
  RequestFormAbsence,
  type AbsencePayload,
} from '@/components/employee/requests/new/RequestFormAbsence';
import {
  RequestFormSwap,
  type SwapPayload,
} from '@/components/employee/requests/new/RequestFormSwap';
import {
  RequestFormNewShift,
  type NewShiftPayload,
} from '@/components/employee/requests/new/RequestFormNewShift';
import {
  RequestFormModifyShift,
  type ModifyShiftPayload,
} from '@/components/employee/requests/new/RequestFormModifyShift';
import { RequestReviewStep } from '@/components/employee/requests/new/RequestReviewStep';

import type { RequestType } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Costanti stepper
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Tipo', description: 'Seleziona il tipo di richiesta' },
  { label: 'Dettagli', description: 'Compila il modulo' },
  { label: 'Riepilogo', description: 'Verifica e invia' },
] as const;

const TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

const VALID_TYPES: RequestType[] = ['absence', 'shift_swap', 'new_shift', 'modify_shift'];

function isValidType(v: string | null): v is RequestType {
  return VALID_TYPES.includes(v as RequestType);
}

// ---------------------------------------------------------------------------
// Tipi issue Zod
// ---------------------------------------------------------------------------

type IssueList = Array<{ path: string[]; message: string }>;

// ---------------------------------------------------------------------------
// Stepper UI
// ---------------------------------------------------------------------------

function WizardStepper({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Passaggi wizard nuova richiesta">
      <ol className="flex items-center gap-0">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isDone = index < currentStep;

          return (
            <li
              key={index}
              className="flex flex-1 items-center"
              aria-current={isActive ? 'step' : undefined}
            >
              <div className="flex w-full items-center gap-2">
                {/* Indicatore step */}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isDone
                      ? 'border-primary bg-primary text-white'
                      : isActive
                        ? 'border-primary text-primary bg-white'
                        : 'border-gray-200 bg-white text-gray-400'
                  )}
                  aria-hidden="true"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                {/* Label */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      isActive ? 'text-primary' : isDone ? 'text-gray-700' : 'text-gray-400'
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="hidden truncate text-xs text-gray-400 sm:block">
                    {step.description}
                  </p>
                </div>

                {/* Connettore */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 flex-1 transition-colors',
                      index < currentStep ? 'bg-primary' : 'bg-gray-200'
                    )}
                    aria-hidden="true"
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Pagina principale
// ---------------------------------------------------------------------------

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Leggi query params
  const typeParam = searchParams.get('type');
  const shiftIdParam = searchParams.get('shiftId');

  // Inizializza step: se ?type= valido → salta step 1, parti da step 2
  const initialType = isValidType(typeParam) ? typeParam : null;
  const [currentStep, setCurrentStep] = useState<number>(initialType ? 1 : 0);
  const [selectedType, setSelectedType] = useState<RequestType | null>(initialType);
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [zodIssues, setZodIssues] = useState<IssueList>([]);

  // Ref per il focus sul titolo del passo corrente
  const stepTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    stepTitleRef.current?.focus();
  }, [currentStep]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleTypeNext() {
    if (!selectedType) return;
    setCurrentStep(1);
  }

  function handleStep2Next(data: Record<string, unknown>) {
    setPayload(data);
    setZodIssues([]);
    setCurrentStep(2);
  }

  function handleBack() {
    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // Se il tipo era pre-selezionato da URL non tornare a step 0
      if (initialType) {
        router.push('/requests');
      } else {
        setCurrentStep(0);
      }
    }
  }

  function handleSuccess() {
    router.push('/requests');
  }

  function handleZodErrors(issues: IssueList) {
    setZodIssues(issues);
    setCurrentStep(1);
  }

  // ---------------------------------------------------------------------------
  // Step title dinamico
  // ---------------------------------------------------------------------------

  const stepTitle = (() => {
    if (currentStep === 0) return 'Tipo richiesta';
    if (currentStep === 1 && selectedType) return TYPE_LABELS[selectedType];
    if (currentStep === 2) return 'Riepilogo';
    return STEPS[currentStep]?.label ?? '';
  })();

  const stepDescription = (() => {
    if (currentStep === 0) return 'Scegli il tipo di richiesta da inviare al responsabile.';
    if (currentStep === 1) return 'Compila i dettagli. I campi obbligatori sono marcati con *.';
    return 'Verifica le informazioni inserite prima di inviare la richiesta.';
  })();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6" aria-label="Procedura guidata nuova richiesta">
      {/* Heading pagina */}
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Nuova richiesta</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Compila il modulo per inviare una richiesta al responsabile
        </p>
      </div>

      {/* Stepper */}
      <WizardStepper currentStep={currentStep} />

      {/* Contenuto step */}
      <div className="border-border rounded-lg border bg-white p-6">
        <h2
          ref={stepTitleRef}
          className="mb-1 text-lg font-semibold text-gray-900 focus:outline-none"
          tabIndex={-1}
        >
          Passo {currentStep + 1}: {stepTitle}
        </h2>
        <p className="mb-5 text-sm text-gray-500">{stepDescription}</p>

        {/* Step 0: Selezione tipo */}
        {currentStep === 0 && (
          <RequestTypeSelector
            value={selectedType}
            onChange={setSelectedType}
            onNext={handleTypeNext}
            onCancel={() => router.push('/requests')}
          />
        )}

        {/* Step 1: Form dinamico per tipo */}
        {currentStep === 1 && selectedType === 'absence' && (
          <RequestFormAbsence
            defaultValues={payload as Partial<AbsencePayload>}
            onNext={(data) => handleStep2Next(data as Record<string, unknown>)}
            onBack={handleBack}
          />
        )}

        {currentStep === 1 && selectedType === 'shift_swap' && (
          <RequestFormSwap
            defaultValues={payload as Partial<SwapPayload>}
            {...(shiftIdParam ? { defaultMyShiftId: shiftIdParam } : {})}
            onNext={(data) => handleStep2Next(data as Record<string, unknown>)}
            onBack={handleBack}
          />
        )}

        {currentStep === 1 && selectedType === 'new_shift' && (
          <RequestFormNewShift
            defaultValues={payload as Partial<NewShiftPayload>}
            onNext={(data) => handleStep2Next(data as Record<string, unknown>)}
            onBack={handleBack}
          />
        )}

        {currentStep === 1 && selectedType === 'modify_shift' && (
          <RequestFormModifyShift
            defaultValues={payload as Partial<ModifyShiftPayload>}
            {...(shiftIdParam ? { defaultShiftId: shiftIdParam } : {})}
            onNext={(data) => handleStep2Next(data as Record<string, unknown>)}
            onBack={handleBack}
          />
        )}

        {/* Errori Zod riportati dallo step 3 → step 2 */}
        {currentStep === 1 && zodIssues.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="border-destructive/50 bg-destructive/5 mt-4 rounded-md border px-4 py-3"
          >
            <p className="text-destructive mb-1 text-sm font-medium">
              Alcuni campi non sono validi. Correggi gli errori e riprova.
            </p>
            <ul className="list-disc space-y-0.5 pl-4">
              {zodIssues.map((issue, i) => (
                <li key={i} className="text-destructive/80 text-xs">
                  {issue.path.join('.')}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step 2: Riepilogo + invio */}
        {currentStep === 2 && selectedType && (
          <RequestReviewStep
            type={selectedType}
            payload={payload}
            onBack={handleBack}
            onSuccess={handleSuccess}
            onZodErrors={handleZodErrors}
          />
        )}
      </div>
    </div>
  );
}
