'use client';

/**
 * components/requests/ApprovalActions.tsx — Azioni admin: Approva / Rifiuta.
 *
 * Regole:
 *   - Visibile solo se status === 'sent' (actionable per admin).
 *   - Approva → POST /api/requests/:id/approve
 *     - Se 409 (RB-14 blocking) → mostra violazioni + disabilita pulsante
 *     - Se 200 → toast "Richiesta approvata" + invalida query
 *   - Rifiuta → apre form inline con textarea (obbligatoria, max 500 chars)
 *     → POST /api/requests/:id/reject
 *     → toast "Richiesta rifiutata"
 *   - Se impact ha blocking violations → Approva pre-emptivamente disabilitato
 *   - Se status !== 'sent' → null (non renderizzato)
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="alert" su errori e violazioni bloccanti
 *   - aria-live="polite" su messaggi di stato
 *   - aria-describedby tra bottone e violazione
 *   - Label esplicite su tutti i form controls
 *
 * data-testid: approval-actions, approve-btn, reject-btn, reject-notes, reject-submit
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import {
  useApproveRequest,
  useRejectRequest,
  useRequestImpact,
  ApprovalBlockedError,
  type RequestRow,
} from '@/hooks/useRequests';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { toast } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Schema rifiuto — motivo obbligatorio (max 500 chars)
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  notes: z
    .string()
    .min(1, 'Il motivo del rifiuto è obbligatorio')
    .max(500, 'Il motivo non può superare i 500 caratteri'),
});

type RejectFormValues = z.infer<typeof rejectSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApprovalActionsProps {
  requestId: string;
  request: RequestRow;
  onApproved?: () => void;
  onRejected?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ApprovalActions({
  requestId,
  request,
  onApproved,
  onRejected,
}: ApprovalActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [blockingViolations, setBlockingViolations] = useState<
    Array<{ ruleId: string; message: string }>
  >([]);

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  // Impact pre-approval: blocking violations disable the Approve button
  const { data: impact } = useRequestImpact(requestId);
  const impactBlocking = impact?.blocking ?? [];
  const hasImpactBlocking = impactBlocking.length > 0;

  const rejectForm = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { notes: '' },
  });

  // ---------------------------------------------------------------------------
  // Guard: non renderizzare per stati non actionable (RB-16, T-REQ-04)
  // ---------------------------------------------------------------------------
  if (request.status !== 'sent') return null;

  // ---------------------------------------------------------------------------
  // Handler: Approva
  // ---------------------------------------------------------------------------
  function handleApprove() {
    setBlockingViolations([]); // reset errori precedenti
    approveMutation.mutate(
      { id: requestId, data: {} },
      {
        onSuccess: () => {
          toast.success('Richiesta approvata');
          onApproved?.();
        },
        onError: (err) => {
          if (err instanceof ApprovalBlockedError) {
            setBlockingViolations(err.blocking);
          } else {
            toast.error(err.message ?? "Errore durante l'approvazione");
          }
        },
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Handler: Rifiuta
  // ---------------------------------------------------------------------------
  function handleReject(data: RejectFormValues) {
    rejectMutation.mutate(
      { id: requestId, data: { notes: data.notes } },
      {
        onSuccess: () => {
          toast.success('Richiesta rifiutata');
          setShowRejectForm(false);
          rejectForm.reset();
          onRejected?.();
        },
        onError: (err) => {
          toast.error(err.message ?? 'Errore durante il rifiuto');
        },
      }
    );
  }

  const isApproveDisabled =
    approveMutation.isPending || hasImpactBlocking || blockingViolations.length > 0;

  return (
    <div
      data-testid="approval-actions"
      className="border-border space-y-4 rounded-lg border bg-white p-5"
      aria-label="Azioni di approvazione"
    >
      <h3 className="text-sm font-semibold text-gray-800">Azioni</h3>

      {/* Violazioni bloccanti dal 409 */}
      {blockingViolations.length > 0 && (
        <div
          id="blocking-violations-msg"
          role="alert"
          className="space-y-1 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-red-800">Approvazione bloccata</p>
          </div>
          <ul className="space-y-1 pl-6 text-xs text-red-700">
            {blockingViolations.map((v, i) => (
              <li key={i}>
                <span className="mr-1 font-mono font-semibold">{v.ruleId}</span>
                {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Impatto blocking hint (dall'impact panel) */}
      {hasImpactBlocking && blockingViolations.length === 0 && (
        <p
          id="impact-blocking-hint"
          className="text-xs text-red-600"
          role="note"
          aria-live="polite"
        >
          Il pannello impatto segnala violazioni bloccanti — approvazione non consentita.
        </p>
      )}

      {/* Pulsanti Approva / Rifiuta */}
      {!showRejectForm && (
        <div className="flex gap-3">
          <Button
            data-testid="approve-btn"
            variant="default"
            className="flex-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            onClick={handleApprove}
            disabled={isApproveDisabled}
            aria-label="Approva richiesta"
            aria-describedby={
              blockingViolations.length > 0
                ? 'blocking-violations-msg'
                : hasImpactBlocking
                  ? 'impact-blocking-hint'
                  : undefined
            }
          >
            {approveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Approvazione...
              </>
            ) : (
              <>
                <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Approva
              </>
            )}
          </Button>

          <Button
            data-testid="reject-btn"
            variant="destructive"
            className="flex-1"
            onClick={() => {
              setShowRejectForm(true);
              setBlockingViolations([]); // pulisce eventuali messaggi 409
            }}
            disabled={approveMutation.isPending}
            aria-label="Rifiuta richiesta"
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Rifiuta
          </Button>
        </div>
      )}

      {/* Form rifiuto inline */}
      {showRejectForm && (
        <Form {...rejectForm}>
          <form
            onSubmit={(e) => void rejectForm.handleSubmit(handleReject)(e)}
            className="space-y-3"
            aria-label="Form rifiuto richiesta"
            noValidate
          >
            <FormField
              control={rejectForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="reject-notes" className="text-sm font-medium text-gray-700">
                    Motivo del rifiuto{' '}
                    <span className="text-red-500" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">(obbligatorio)</span>
                  </Label>
                  <FormControl>
                    <Textarea
                      id="reject-notes"
                      data-testid="reject-notes"
                      placeholder="Inserisci una motivazione per il dipendente (obbligatoria)..."
                      rows={4}
                      maxLength={500}
                      aria-describedby="reject-notes-counter"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <FormMessage />
                    <p
                      id="reject-notes-counter"
                      className="text-xs text-gray-400 tabular-nums"
                      aria-live="polite"
                    >
                      {(field.value ?? '').length}/500
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                data-testid="reject-submit"
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Rifiuto in corso...
                  </>
                ) : (
                  'Conferma rifiuto'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowRejectForm(false);
                  rejectForm.reset();
                }}
                disabled={rejectMutation.isPending}
                aria-label="Annulla rifiuto"
              >
                Annulla
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
