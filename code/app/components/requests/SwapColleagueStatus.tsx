'use client';

/**
 * components/requests/SwapColleagueStatus.tsx — Stato accettazione collega (shift_swap).
 *
 * Renderizzato quando request.type === 'shift_swap' && request.status === 'awaiting_colleague'.
 *
 * Mostra:
 *   - Badge "In attesa del collega" con tooltip informativo (RF-M, RF-F CA3)
 *   - Collega target (da payload.targetUserFirstName / targetUserLastName / targetUserId)
 *   - Data proposta (da payload.proposedDate o payload.targetShiftDate)
 *   - Nota "azioni non disponibili all'admin" (l'admin non può approvare in questa fase)
 *
 * SSE: il componente usa useNotifications() tramite il layout — quando arriva
 * swap.accepted, TanStack Query invalida ['requests'] e la pagina si aggiorna
 * automaticamente con il nuovo stato.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="status" per lo stato attuale
 *   - aria-label sul tooltip
 *
 * data-testid: swap-colleague-status
 */

import { Clock, UserCheck, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RequestRow } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SwapPayload {
  targetUserId?: string;
  targetUserFirstName?: string;
  targetUserLastName?: string;
  proposedDate?: string;
  targetShiftDate?: string;
  targetShiftId?: string;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SwapColleagueStatusProps {
  request: RequestRow;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function SwapColleagueStatus({ request }: SwapColleagueStatusProps) {
  // Renderizza solo per scambi in attesa del collega
  if (request.type !== 'shift_swap' || request.status !== 'awaiting_colleague') {
    return null;
  }

  const payload = (request.payload ?? {}) as SwapPayload;

  const colleageName =
    payload.targetUserFirstName || payload.targetUserLastName
      ? `${payload.targetUserFirstName ?? ''} ${payload.targetUserLastName ?? ''}`.trim()
      : payload.targetUserId
        ? `Collega (ID: ${payload.targetUserId.slice(0, 8)}…)`
        : 'Collega destinatario';

  const proposedDate = payload.proposedDate ?? payload.targetShiftDate;

  return (
    <div
      data-testid="swap-colleague-status"
      className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-5"
      aria-label="Stato accettazione collega per scambio turno"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-blue-900">In attesa del collega</h3>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-full p-1 text-blue-400 hover:text-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Informazioni sullo stato dello scambio"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[280px]">
            <p className="text-xs">
              Lo scambio turno è in attesa dell&apos;accettazione di <strong>{colleageName}</strong>
              . Quando il collega accetta, lo stato si aggiorna automaticamente. Le azioni di
              approvazione/rifiuto non sono disponibili fino all&apos;accettazione del collega.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Info collega */}
      <div
        role="status"
        aria-label={`In attesa dell'accettazione di ${colleageName}`}
        className="flex items-start gap-3"
      >
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-900">{colleageName}</p>
          {proposedDate && (
            <p className="text-xs text-blue-700">
              Data proposta: <time dateTime={proposedDate}>{formatDate(proposedDate)}</time>
            </p>
          )}
        </div>
      </div>

      {/* Nota azioni disabilitate */}
      <div className="rounded-md border border-blue-200 bg-blue-100 px-3 py-2">
        <p className="text-xs text-blue-700">
          Le azioni di approvazione non sono disponibili finché il collega non ha accettato la
          proposta di scambio. La pagina si aggiornerà automaticamente quando il collega risponde.
        </p>
      </div>
    </div>
  );
}
