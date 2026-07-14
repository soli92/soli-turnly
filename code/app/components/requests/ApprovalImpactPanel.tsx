'use client';

/**
 * components/requests/ApprovalImpactPanel.tsx — Pannello anteprima impatto pre-approvazione.
 *
 * Consuma GET /api/requests/:id/impact (TSK-020, RB-14).
 * Calcola l'impatto sul planning prima dell'approvazione:
 *   - assenza: giorni bloccati + turni in conflitto
 *   - scambio: RB-10 per entrambe le parti
 *   - nuovo turno: RB-01..08 per il dipendente
 *
 * Risposta attesa:
 *   { blocking: [{ ruleId, message }], warnings: [{ ruleId, message }], summary: string }
 *
 * NOTA (G-009): l'endpoint non è ancora implementato sul BE.
 * Se l'API risponde 404/501, il pannello mostra una nota informativa
 * e il pannello viene nascosto silenziosamente.
 *
 * Accessibility (WCAG 2.2 AA):
 *   - role="alert" su violazioni bloccanti
 *   - role="status" su warnings
 *   - aria-busy su skeleton loading
 *
 * data-testid: approval-impact-panel
 */

import { AlertTriangle, XCircle, Info, CheckCircle2 } from 'lucide-react';
import { useRequestImpact } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApprovalImpactPanelProps {
  requestId: string;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ApprovalImpactPanel({ requestId }: ApprovalImpactPanelProps) {
  const { data: impact, isLoading, isError } = useRequestImpact(requestId);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div
        data-testid="approval-impact-panel"
        className="border-border space-y-3 rounded-lg border bg-white p-5"
        aria-busy="true"
        aria-label="Calcolo impatto in corso"
      >
        <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Errore di rete (non 404/501 — quelli vengono gestiti come empty result)
  // ---------------------------------------------------------------------------
  if (isError) {
    return (
      <div
        data-testid="approval-impact-panel"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        role="status"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="text-sm text-amber-700">
            Impossibile caricare l&apos;anteprima impatto. Puoi procedere con l&apos;approvazione,
            ma il BE eseguirà la rivalidazione al momento dell&apos;approvazione (RB-14).
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Nessun dato (endpoint non implementato o nessun impatto)
  // ---------------------------------------------------------------------------
  if (
    !impact ||
    (impact.blocking.length === 0 && impact.warnings.length === 0 && !impact.summary)
  ) {
    return null;
  }

  const hasBlocking = impact.blocking.length > 0;
  const hasWarnings = impact.warnings.length > 0;

  return (
    <div
      data-testid="approval-impact-panel"
      className="border-border space-y-4 rounded-lg border bg-white p-5"
      aria-label="Anteprima impatto approvazione"
    >
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-800">Anteprima impatto</h3>
      </div>

      {/* Sommario */}
      {impact.summary && <p className="text-sm text-gray-600">{impact.summary}</p>}

      {/* Violazioni bloccanti */}
      {hasBlocking && (
        <div
          role="alert"
          aria-label={`${impact.blocking.length} violazioni bloccanti rilevate`}
          className="space-y-2 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-red-800">
              Violazioni bloccanti ({impact.blocking.length})
            </p>
          </div>
          <ul className="space-y-1 pl-6" aria-label="Lista violazioni bloccanti">
            {impact.blocking.map((v, i) => (
              <li key={i} className="text-xs text-red-700">
                <span className="mr-1 font-mono font-semibold">{v.ruleId}</span>
                {v.message}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs font-medium text-red-600">
            Approvazione bloccata — risolvere le violazioni prima di procedere.
          </p>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div
          role="status"
          aria-label={`${impact.warnings.length} avvisi`}
          className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-amber-800">
              Avvisi ({impact.warnings.length})
            </p>
          </div>
          <ul className="space-y-1 pl-6" aria-label="Lista avvisi">
            {impact.warnings.map((v, i) => (
              <li key={i} className="text-xs text-amber-700">
                <span className="mr-1 font-mono font-semibold">{v.ruleId}</span>
                {v.message}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-600">
            L&apos;approvazione è possibile ma potrebbero verificarsi problemi di pianificazione.
          </p>
        </div>
      )}

      {/* Nessun problema */}
      {!hasBlocking && !hasWarnings && impact.summary && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
          <p className="text-sm text-green-700">
            Nessuna violazione rilevata — l&apos;approvazione è sicura.
          </p>
        </div>
      )}
    </div>
  );
}
