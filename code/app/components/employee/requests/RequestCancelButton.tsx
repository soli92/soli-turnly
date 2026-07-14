'use client';

/**
 * components/employee/requests/RequestCancelButton.tsx
 *
 * Bottone per annullare una richiesta (RF-M CA5, RB-16).
 *
 * Regole di visibilità (RB-16):
 *   - Visibile solo se status IN ('draft', 'sent')
 *   - Se status = 'approved' | 'applied' | 'rejected' | 'cancelled' → assente
 *
 * Gestione 409 (T-REQ-04):
 *   - Se la richiesta è già stata applicata → errore "Non più annullabile"
 *
 * Flusso UX:
 *   1. Utente clicca "Annulla richiesta"
 *   2. AlertDialog di conferma appare
 *   3. Conferma → POST /api/requests/:id/cancel
 *   4. In caso di 409 → mostra errore inline
 *
 * Accessibility (WCAG 2.2 AA):
 *   - AlertDialog con focus trap
 *   - aria-disabled su bottone durante mutation
 *   - role="alert" su errori
 *
 * data-testid: cancel-request-btn, cancel-confirm-btn, cancel-error
 */

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCancelRequest, CancelNotAllowedError } from '@/hooks/useRequests';
import type { RequestStatus } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface RequestCancelButtonProps {
  requestId: string;
  status: RequestStatus;
  onCancelled?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Statuses che consentono l'annullamento (RB-16)
// ---------------------------------------------------------------------------

const CANCELLABLE_STATUSES: RequestStatus[] = ['draft', 'sent'];

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestCancelButton({ requestId, status, onCancelled }: RequestCancelButtonProps) {
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelMutation = useCancelRequest();

  // RB-16: non mostrare se lo stato non lo consente
  if (!CANCELLABLE_STATUSES.includes(status)) {
    return null;
  }

  function handleConfirmCancel() {
    setCancelError(null);
    cancelMutation.mutate(requestId, {
      onSuccess: () => {
        onCancelled?.();
      },
      onError: (err) => {
        if (err instanceof CancelNotAllowedError) {
          setCancelError(err.message);
        } else {
          setCancelError(err instanceof Error ? err.message : 'Si è verificato un errore');
        }
      },
    });
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            data-testid="cancel-request-btn"
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
            disabled={cancelMutation.isPending}
            aria-disabled={cancelMutation.isPending}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {cancelMutation.isPending ? 'Annullamento...' : 'Annulla richiesta'}
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la richiesta?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. La richiesta passerà allo stato
              &quot;Annullata&quot; e non potrà più essere approvata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Indietro</AlertDialogCancel>
            <AlertDialogAction
              data-testid="cancel-confirm-btn"
              onClick={handleConfirmCancel}
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            >
              Sì, annulla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Errore T-REQ-04 o generico */}
      {cancelError && (
        <p data-testid="cancel-error" role="alert" className="text-xs text-red-600">
          {cancelError}
        </p>
      )}
    </div>
  );
}
