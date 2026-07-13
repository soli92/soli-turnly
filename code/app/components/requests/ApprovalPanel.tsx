'use client';

/**
 * components/requests/ApprovalPanel.tsx — Panel approva/rifiuta richiesta.
 *
 * Mostra anteprima della richiesta (tipo, richiedente, date, warning regole).
 * Bottone Approva (verde) → POST /api/requests/{id}/approve
 * Bottone Rifiuta (rosso) → apre textarea note → POST /api/requests/{id}/reject
 *
 * Accessibility: WCAG 2.2 AA
 * - Bottoni con label esplicite
 * - Alert role su violazioni
 * - aria-live su stati di loading
 *
 * data-testid: approval-panel, approve-btn, reject-btn, reject-notes
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

import { resolveRequestSchema, type ResolveRequestInput } from '@/lib/zod';
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
import { useApproveRequest, useRejectRequest, type RequestRow } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUEST_TYPE_LABELS: Record<RequestRow['type'], string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

const REQUEST_STATUS_LABELS: Record<RequestRow['status'], string> = {
  pending: 'In attesa',
  approved: 'Approvata',
  rejected: 'Rifiutata',
  cancelled: 'Annullata',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApprovalPanelProps {
  requestId: string;
  request: RequestRow;
  warnings?: string[];
  onApprove?: () => void;
  onReject?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ApprovalPanel({
  requestId,
  request,
  warnings = [],
  onApprove,
  onReject,
}: ApprovalPanelProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  const rejectForm = useForm<ResolveRequestInput>({
    resolver: zodResolver(resolveRequestSchema),
    defaultValues: { notes: '' },
  });

  const isPending = request.status === 'pending';

  function handleApprove() {
    approveMutation.mutate(
      { id: requestId, data: {} },
      {
        onSuccess: () => {
          onApprove?.();
        },
      },
    );
  }

  function handleReject(data: ResolveRequestInput) {
    rejectMutation.mutate(
      { id: requestId, data },
      {
        onSuccess: () => {
          setShowRejectForm(false);
          rejectForm.reset();
          onReject?.();
        },
      },
    );
  }

  return (
    <div
      data-testid="approval-panel"
      className="rounded-lg border border-border bg-white p-6 space-y-4"
    >
      {/* Intestazione richiesta */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            {REQUEST_TYPE_LABELS[request.type]}
          </h3>
          <span
            className={
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ' +
              (request.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : request.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800')
            }
          >
            {REQUEST_STATUS_LABELS[request.status]}
          </span>
        </div>
        {request.userFirstName && (
          <p className="text-sm text-gray-600">
            Richiedente: {request.userFirstName} {request.userLastName}
          </p>
        )}
        <p className="text-xs text-gray-400">
          Inviata il{' '}
          {new Date(request.createdAt).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Payload sintetico */}
      {request.payload && Object.keys(request.payload).length > 0 && (
        <div className="rounded-md bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-700 mb-1">Dettagli richiesta</p>
          {Object.entries(request.payload).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-gray-600">
              <span className="font-medium capitalize">{key}:</span>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warning regole */}
      {warnings.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-800">
              Avvisi impatto ({warnings.length})
            </p>
          </div>
          <ul className="space-y-1 pl-6 list-disc">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Azioni — visibili solo se pending */}
      {isPending && (
        <div className="space-y-3">
          {!showRejectForm ? (
            <div className="flex gap-3">
              <Button
                data-testid="approve-btn"
                variant="default"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                aria-label="Approva richiesta"
              >
                {approveMutation.isPending ? (
                  <>
                    <span className="animate-spin mr-2" aria-hidden="true">⏳</span>
                    Approvazione...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                    Approva
                  </>
                )}
              </Button>
              <Button
                data-testid="reject-btn"
                variant="destructive"
                className="flex-1"
                onClick={() => setShowRejectForm(true)}
                disabled={approveMutation.isPending}
                aria-label="Rifiuta richiesta"
              >
                <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                Rifiuta
              </Button>
            </div>
          ) : (
            /* Form rifiuto con note */
            <Form {...rejectForm}>
              <form
                onSubmit={rejectForm.handleSubmit(handleReject)}
                className="space-y-3"
                aria-label="Form rifiuto richiesta"
              >
                <FormField
                  control={rejectForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo del rifiuto</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="reject-notes"
                          placeholder="Inserisci una motivazione per il dipendente..."
                          rows={3}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    className="flex-1"
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? 'Rifiuto in corso...' : 'Conferma rifiuto'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowRejectForm(false);
                      rejectForm.reset();
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    Annulla
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {/* Messaggi di errore mutation */}
          {(approveMutation.isError || rejectMutation.isError) && (
            <p role="alert" className="text-xs text-destructive">
              {(approveMutation.error ?? rejectMutation.error)?.message ??
                'Si è verificato un errore'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
