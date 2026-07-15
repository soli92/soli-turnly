'use client';

/**
 * app/(admin)/swap/_components/SwapViolationSummary.tsx — TSK-026.
 *
 * Lista violazioni bloccanti (rosso) e avvisi (giallo) restituiti da
 * validateSwap (RB-10) / GET /api/admin/swap/preview.
 *
 * Ogni voce indica:
 *   - Parte coinvolta (A o B)
 *   - ID regola (es. RB-01)
 *   - Messaggio descrittivo
 *
 * RF-F CA1, CA2.
 */

import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { RuleViolation } from '@/lib/rules/types';

interface SwapViolationSummaryProps {
  blocking: RuleViolation[];
  warnings: RuleViolation[];
  /** Se true mostra anche le info violations (severity=info). */
  showInfo?: boolean;
  info?: RuleViolation[];
}

function ViolationRow({
  violation,
  variant,
}: {
  violation: RuleViolation;
  variant: 'blocking' | 'warning' | 'info';
}) {
  const config = {
    blocking: {
      rowClass: 'bg-red-50 border-red-200',
      iconClass: 'text-red-500',
      badgeClass: 'bg-red-100 text-red-700',
      Icon: AlertCircle,
    },
    warning: {
      rowClass: 'bg-yellow-50 border-yellow-200',
      iconClass: 'text-yellow-500',
      badgeClass: 'bg-yellow-100 text-yellow-700',
      Icon: AlertTriangle,
    },
    info: {
      rowClass: 'bg-blue-50 border-blue-200',
      iconClass: 'text-blue-500',
      badgeClass: 'bg-blue-100 text-blue-700',
      Icon: Info,
    },
  }[variant];

  // Determina la parte (A o B) dal campo party popolato dalla route.
  const party = violation.party ?? null;

  return (
    <li
      className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm ${config.rowClass}`}
    >
      <config.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.iconClass}`} aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.badgeClass}`}>
            {violation.ruleId}
          </span>
          {party && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
              Parte {party}
            </span>
          )}
        </div>
        <p className="text-gray-700">{violation.message}</p>
      </div>
    </li>
  );
}

export function SwapViolationSummary({
  blocking,
  warnings,
  showInfo = false,
  info = [],
}: SwapViolationSummaryProps) {
  const hasBlocking = blocking.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasInfo = showInfo && info.length > 0;

  if (!hasBlocking && !hasWarnings && !hasInfo) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800"
      >
        <AlertCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
        Nessuna violazione rilevata. Lo scambio è valido.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sezione violazioni bloccanti */}
      {hasBlocking && (
        <section aria-labelledby="blocking-violations-title">
          <h3
            id="blocking-violations-title"
            className="mb-2 text-xs font-semibold tracking-wider text-red-600 uppercase"
          >
            Violazioni bloccanti ({blocking.length})
          </h3>
          <ul className="space-y-2" aria-live="polite">
            {blocking.map((v, i) => (
              <ViolationRow key={`blocking-${v.ruleId}-${i}`} violation={v} variant="blocking" />
            ))}
          </ul>
        </section>
      )}

      {/* Sezione avvisi */}
      {hasWarnings && (
        <section aria-labelledby="warnings-title">
          <h3
            id="warnings-title"
            className="mb-2 text-xs font-semibold tracking-wider text-yellow-600 uppercase"
          >
            Avvisi ({warnings.length})
          </h3>
          <ul className="space-y-2" aria-live="polite">
            {warnings.map((v, i) => (
              <ViolationRow key={`warning-${v.ruleId}-${i}`} violation={v} variant="warning" />
            ))}
          </ul>
        </section>
      )}

      {/* Sezione info */}
      {hasInfo && (
        <section aria-labelledby="info-violations-title">
          <h3
            id="info-violations-title"
            className="mb-2 text-xs font-semibold tracking-wider text-blue-600 uppercase"
          >
            Note ({info.length})
          </h3>
          <ul className="space-y-2">
            {info.map((v, i) => (
              <ViolationRow key={`info-${v.ruleId}-${i}`} violation={v} variant="info" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
