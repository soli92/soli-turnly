'use client';

/**
 * components/employee/requests/SwapAcceptRejectPanel.tsx
 *
 * Pannello accetta/rifiuta scambio turno per il collega destinatario.
 *
 * Regole di sicurezza (T-SEC-08, RF-M CA6):
 *   - Visibile SOLO se session.user.id === payload.targetUserId
 *   - La verifica è fatta lato client; il BE ri-verifica server-side
 *
 * Azioni disponibili:
 *   - Accetta → POST /api/requests/:id/accept-swap
 *   - Rifiuta → POST /api/requests/:id/reject-swap (GAP-TSK022-001: endpoint mancante)
 *
 * Accessibility (WCAG 2.2 AA):
 *   - AlertDialog per conferma azioni
 *   - role="alert" su errori
 *   - aria-disabled durante mutation
 *
 * data-testid: swap-accept-reject-panel, accept-swap-btn, reject-swap-btn
 */

import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useSession } from 'next-auth/react';
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
import { useAcceptSwap, useRejectSwap } from '@/hooks/useRequests';
import type { RequestRow } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Payload swap (da requestRow.payload)
// ---------------------------------------------------------------------------

interface SwapPayload {
  targetUserId?: string;
  targetUserFirstName?: string;
  targetUserLastName?: string;
  requesterShiftId?: string;
  targetShiftId?: string;
  requesterShiftDate?: string;
  targetShiftDate?: string;
  requesterShiftStart?: string;
  requesterShiftEnd?: string;
  targetShiftStart?: string;
  targetShiftEnd?: string;
  requesterShiftType?: string;
  targetShiftType?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShiftTime(start?: string, end?: string): string {
  if (!start && !end) return '—';
  const fmt = (dt?: string) =>
    dt
      ? new Date(dt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '?';
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatShiftDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SwapAcceptRejectPanelProps {
  request: RequestRow;
  onActioned?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SwapAcceptRejectPanel({ request, onActioned }: SwapAcceptRejectPanelProps) {
  const { data: session } = useSession();
  const [actionError, setActionError] = useState<string | null>(null);

  const acceptMutation = useAcceptSwap();
  const rejectMutation = useRejectSwap();

  const isPending = acceptMutation.isPending || rejectMutation.isPending;

  const payload = (request.payload ?? {}) as SwapPayload;
  const currentUserId = session?.user?.id;

  // T-SEC-08: mostra solo se l'utente corrente è il destinatario
  if (!currentUserId || payload.targetUserId !== currentUserId) {
    return null;
  }

  const requesterName =
    request.userFirstName || request.userLastName
      ? `${request.userFirstName ?? ''} ${request.userLastName ?? ''}`.trim()
      : 'Il richiedente';

  function handleAccept() {
    setActionError(null);
    acceptMutation.mutate(
      { id: request.id },
      {
        onSuccess: () => onActioned?.(),
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : "Errore durante l'accettazione");
        },
      }
    );
  }

  function handleReject() {
    setActionError(null);
    rejectMutation.mutate(
      { id: request.id },
      {
        onSuccess: () => onActioned?.(),
        onError: (err) => {
          setActionError(err instanceof Error ? err.message : 'Errore durante il rifiuto');
        },
      }
    );
  }

  return (
    <div
      data-testid="swap-accept-reject-panel"
      className="space-y-5 rounded-lg border border-amber-200 bg-amber-50 p-5"
      aria-label="Azioni scambio turno ricevuto"
    >
      {/* Titolo */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-amber-900">
          Proposta di scambio da {requesterName}
        </h3>
      </div>

      {/* Dettaglio turni */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Turno del richiedente (da cedere al collega) */}
        <div className="space-y-1 rounded-md border border-amber-200 bg-white p-3">
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Turno di {requesterName}
          </p>
          <p className="text-sm font-medium text-gray-900">
            {formatShiftDate(payload.requesterShiftDate ?? payload.targetShiftDate)}
          </p>
          <p className="text-sm text-gray-700">
            {formatShiftTime(payload.requesterShiftStart, payload.requesterShiftEnd)}
          </p>
          {payload.requesterShiftType && (
            <p className="text-xs text-gray-500">{payload.requesterShiftType}</p>
          )}
        </div>

        {/* Turno del dipendente corrente (da cedere al richiedente) */}
        <div className="space-y-1 rounded-md border border-blue-200 bg-white p-3">
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            Il tuo turno (da cedere)
          </p>
          <p className="text-sm font-medium text-gray-900">
            {formatShiftDate(payload.targetShiftDate ?? payload.requesterShiftDate)}
          </p>
          <p className="text-sm text-gray-700">
            {formatShiftTime(payload.targetShiftStart, payload.targetShiftEnd)}
          </p>
          {payload.targetShiftType && (
            <p className="text-xs text-gray-500">{payload.targetShiftType}</p>
          )}
        </div>
      </div>

      {/* Nota informativa */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-100 px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-xs text-amber-800">
          Se accetti, i due turni verranno scambiati e l&apos;admin riceverà una notifica per
          l&apos;approvazione finale.
        </p>
      </div>

      {/* Bottoni azione */}
      <div className="flex gap-3">
        {/* Accetta */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              data-testid="accept-swap-btn"
              variant="default"
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              disabled={isPending}
              aria-disabled={isPending}
            >
              <CheckCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {acceptMutation.isPending ? 'Accettazione...' : 'Accetta scambio'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Accettare lo scambio?</AlertDialogTitle>
              <AlertDialogDescription>
                Confermando, accetti la proposta di scambio turno di{' '}
                <strong>{requesterName}</strong>. L&apos;admin riceverà una notifica per
                l&apos;approvazione finale.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAccept}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Sì, accetta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rifiuta */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              data-testid="reject-swap-btn"
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
              disabled={isPending}
              aria-disabled={isPending}
            >
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {rejectMutation.isPending ? 'Rifiuto...' : 'Rifiuta scambio'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rifiutare lo scambio?</AlertDialogTitle>
              <AlertDialogDescription>
                Confermando, rifiuti la proposta di scambio turno di{' '}
                <strong>{requesterName}</strong>. Il richiedente verrà notificato.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Sì, rifiuta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Errore azione */}
      {actionError && (
        <p role="alert" className="text-xs text-red-600">
          {actionError}
        </p>
      )}
    </div>
  );
}
