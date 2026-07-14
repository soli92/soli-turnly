'use client';

/**
 * components/recurrence/RecurrenceWizard.tsx
 *
 * Orchestratore del wizard a 3 step per la creazione di ricorrenze/cicli.
 *
 * Step:
 *   0 — Tipo: settimanale | ciclo rotativo        (RecurrenceTypeStep)
 *   1 — Configurazione: target, date, festivi      (RecurrenceSequenceStep)
 *   2 — Anteprima + generazione                    (RecurrencePreviewStep)
 *
 * Il wizard mantiene i dati accumulati tra gli step (no reset al back).
 * I dati step 1 + step 2 vengono combinati nel payload del passo 3.
 *
 * Accessibility: WCAG 2.2 AA
 *   - Stepper con aria-current="step" sull'elemento attivo
 *   - aria-label="Procedura guidata ricorrenza turni" sul contenitore
 *   - Step completati con icona check aria-hidden
 *   - Focus sul titolo del passo corrente a ogni avanzamento
 *
 * TSK-019, RF-E
 */

import { useState, useRef, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecurrenceTypeStep, type Step1Data } from './step1-RecurrenceTypeStep';
import { RecurrenceSequenceStep, type Step2Data } from './step2-RecurrenceSequenceStep';
import { RecurrencePreviewStep } from './step3-RecurrencePreviewStep';
import type { RecurrenceWizardPayload } from '@/hooks/useRecurrences';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Costanti stepper
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'Tipo', description: 'Settimanale o ciclo rotativo' },
  { label: 'Configurazione', description: 'Dipendenti e date' },
  { label: 'Anteprima', description: 'Verifica e genera' },
] as const;

// ---------------------------------------------------------------------------
// Valori di default wizard
// ---------------------------------------------------------------------------

const defaultStep1: Step1Data = {
  type: 'weekly',
  weeklyDays: [],
  rotatingSequence: [],
  cycleLength: 3,
};

const defaultStep2: Step2Data = {
  userIds: [],
  startDate: '',
  endDate: '',
  skipHolidays: false,
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecurrenceWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data>(defaultStep1);
  const [step2Data, setStep2Data] = useState<Step2Data>(defaultStep2);
  const [isCompleted, setIsCompleted] = useState(false);

  // Ref per il focus sul titolo del passo corrente
  const stepTitleRef = useRef<HTMLHeadingElement>(null);

  // Sposta il focus sul titolo del passo quando cambia currentStep
  useEffect(() => {
    stepTitleRef.current?.focus();
  }, [currentStep]);

  // ---------------------------------------------------------------------------
  // Costruisce il payload per il passo 3
  // ---------------------------------------------------------------------------

  function buildPayload(s1: Step1Data, s2: Step2Data): RecurrenceWizardPayload {
    const base: RecurrenceWizardPayload = {
      type: s1.type,
      userIds: s2.userIds,
      startDate: s2.startDate,
      endDate: s2.endDate,
      skipHolidays: s2.skipHolidays,
    };

    if (s1.type === 'weekly') {
      base.weeklyDays = s1.weeklyDays;
    } else {
      base.rotatingSequence = s1.rotatingSequence;
      base.cycleLength = s1.cycleLength;
    }

    return base;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleStep1Complete(data: Step1Data) {
    setStep1Data(data);
    setCurrentStep(1);
  }

  function handleStep2Complete(data: Step2Data) {
    setStep2Data(data);
    setCurrentStep(2);
  }

  function handleGenerateSuccess(generated: number, skipped: number) {
    setIsCompleted(true);
    // Ricarichiamo la lista dopo un breve delay per dare tempo al job
    setTimeout(() => {
      router.push('/admin/recurrence');
      router.refresh();
    }, 2000);
    void generated; // usato nel toast nel step 3
    void skipped;
  }

  // ---------------------------------------------------------------------------
  // Render: completato
  // ---------------------------------------------------------------------------

  if (isCompleted) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 py-12 text-center"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Generazione completata</h2>
          <p className="mt-1 text-sm text-gray-500">
            Stai per essere reindirizzato alla lista ricorrenze…
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/recurrence')}>
          Vai alla lista ricorrenze
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: stepper + passo corrente
  // ---------------------------------------------------------------------------

  const payload = buildPayload(step1Data, step2Data);

  return (
    <div className="space-y-6" aria-label="Procedura guidata ricorrenza turni">
      {/* Stepper */}
      <nav aria-label="Passaggi wizard ricorrenza">
        <ol className="flex items-center gap-0">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <li
                key={index}
                className="flex flex-1 items-center"
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="flex w-full items-center gap-2">
                  {/* Pallino / check */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors ${
                      isCompleted
                        ? 'border-primary bg-primary text-white'
                        : isActive
                          ? 'border-primary text-primary bg-white'
                          : 'border-gray-200 bg-white text-gray-400'
                    }`}
                    aria-hidden="true"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Label passo */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-medium ${
                        isActive ? 'text-primary' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                      }`}
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
                      className={`mx-2 h-0.5 flex-1 transition-colors ${
                        index < currentStep ? 'bg-primary' : 'bg-gray-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Titolo passo corrente */}
      <div className="border-border rounded-lg border bg-white p-6">
        <h2
          ref={stepTitleRef}
          className="mb-1 text-lg font-semibold text-gray-900 focus:outline-none"
          tabIndex={-1}
        >
          Passo {currentStep + 1}: {STEPS[currentStep]?.label}
        </h2>
        <p className="mb-5 text-sm text-gray-500">
          {currentStep === 0 && 'Scegli il tipo di ricorrenza e configura il modello di turno.'}
          {currentStep === 1 && "Seleziona i dipendenti e definisci l'intervallo date."}
          {currentStep === 2 &&
            "Verifica l'anteprima dei turni che verranno generati, poi avvia la generazione."}
        </p>

        {/* Passo 1 */}
        {currentStep === 0 && (
          <RecurrenceTypeStep initialData={step1Data} onComplete={handleStep1Complete} />
        )}

        {/* Passo 2 */}
        {currentStep === 1 && (
          <RecurrenceSequenceStep
            initialData={step2Data}
            onComplete={handleStep2Complete}
            onBack={() => setCurrentStep(0)}
          />
        )}

        {/* Passo 3 */}
        {currentStep === 2 && (
          <RecurrencePreviewStep
            payload={payload}
            onBack={() => setCurrentStep(1)}
            onSuccess={handleGenerateSuccess}
          />
        )}
      </div>
    </div>
  );
}
