'use client';

/**
 * components/employee/requests/RequestTimeline.tsx
 *
 * Cronologia visiva della richiesta: inviata → in revisione → decisione.
 * Deriva le tappe da `submittedAt`, `resolvedAt` e `status` della RequestRow.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="list" sulla lista delle tappe
 *   - aria-current="step" sulla tappa corrente
 *   - Colori non sono l'unico mezzo di comunicazione (testo visibile)
 *
 * data-testid: request-timeline
 */

import { CheckCircle, Clock, Circle, XCircle } from 'lucide-react';
import type { RequestRow, RequestStatus } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Tipi interni
// ---------------------------------------------------------------------------

type StepState = 'done' | 'current' | 'pending' | 'failed';

interface TimelineStep {
  id: string;
  label: string;
  sublabel?: string | undefined;
  state: StepState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSteps(request: RequestRow): TimelineStep[] {
  const { status, submittedAt, resolvedAt } = request;

  const isFinalPositive = status === 'approved' || status === 'applied';
  const isFinalNegative = status === 'rejected' || status === 'cancelled';

  // Tappa 1 — Inviata
  const sentState: StepState = submittedAt ? 'done' : status === 'draft' ? 'current' : 'pending';

  // Tappa 2 — In revisione
  let reviewState: StepState;
  if (isFinalPositive || isFinalNegative) {
    reviewState = 'done';
  } else if (status === 'sent' || status === 'awaiting_colleague') {
    reviewState = 'current';
  } else if (submittedAt) {
    reviewState = 'done';
  } else {
    reviewState = 'pending';
  }

  // Tappa 3 — Decisione
  let decisionState: StepState;
  if (status === 'approved' || status === 'applied') {
    decisionState = 'done';
  } else if (status === 'rejected' || status === 'cancelled') {
    decisionState = 'failed';
  } else {
    decisionState = 'pending';
  }

  const STATUS_DECISION_LABELS: Partial<Record<RequestStatus, string>> = {
    approved: 'Approvata',
    applied: 'Applicata',
    rejected: 'Rifiutata',
    cancelled: 'Annullata',
  };

  return [
    {
      id: 'sent',
      label: 'Inviata',
      sublabel: submittedAt ? formatDate(submittedAt) : undefined,
      state: sentState,
    },
    {
      id: 'review',
      label: status === 'awaiting_colleague' ? 'In attesa collega' : 'In revisione',
      state: reviewState,
    },
    {
      id: 'decision',
      label: STATUS_DECISION_LABELS[status] ?? 'Decisione',
      sublabel: resolvedAt ? formatDate(resolvedAt) : undefined,
      state: decisionState,
    },
  ];
}

// ---------------------------------------------------------------------------
// Icona per stato tappa
// ---------------------------------------------------------------------------

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return <CheckCircle className="h-5 w-5 text-green-600" aria-hidden="true" />;
  }
  if (state === 'current') {
    return <Clock className="h-5 w-5 text-blue-600" aria-hidden="true" />;
  }
  if (state === 'failed') {
    return <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />;
  }
  return <Circle className="h-5 w-5 text-gray-300" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Componente principale
// ---------------------------------------------------------------------------

interface RequestTimelineProps {
  request: RequestRow;
}

export function RequestTimeline({ request }: RequestTimelineProps) {
  const steps = buildSteps(request);

  return (
    <div data-testid="request-timeline" aria-label="Cronologia richiesta">
      <ol role="list" className="relative flex flex-col gap-0">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isCurrent = step.state === 'current';

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? 'step' : undefined}
              className="relative flex gap-4"
            >
              {/* Linea verticale connettore */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={[
                    'absolute top-5 left-[9px] h-full w-0.5',
                    step.state === 'done' ? 'bg-green-300' : 'bg-gray-200',
                  ].join(' ')}
                />
              )}

              {/* Icona */}
              <div className="relative z-10 shrink-0 pt-0.5">
                <StepIcon state={step.state} />
              </div>

              {/* Testo */}
              <div className="min-w-0 pb-6">
                <p
                  className={[
                    'text-sm font-medium',
                    step.state === 'done'
                      ? 'text-gray-900'
                      : step.state === 'current'
                        ? 'font-semibold text-blue-700'
                        : step.state === 'failed'
                          ? 'text-red-700'
                          : 'text-gray-400',
                  ].join(' ')}
                >
                  {step.label}
                </p>
                {step.sublabel && <p className="mt-0.5 text-xs text-gray-500">{step.sublabel}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
