'use client';

/**
 * components/matrix/ViolationBadge.tsx — Badge inline per violazioni regole.
 *
 * Mostra icona ⚠ (warning) o ✕ (blocking) con tooltip contenente il messaggio.
 *
 * Props:
 *   violations - Lista violazioni da mostrare
 *   severity   - 'blocking' | 'warning' (determina colore e icona)
 *
 * Accessibility: WCAG 2.2 AA
 * - Tooltip accessibile via keyboard (focus/hover)
 * - aria-label descrittivo sul trigger
 *
 * data-testid="violation-badge-{ruleId}" per Playwright (TSK-010)
 */

import { AlertTriangle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { RuleViolation } from '@/types';

interface ViolationBadgeProps {
  violations: RuleViolation[];
  severity: 'blocking' | 'warning';
}

export function ViolationBadge({ violations, severity }: ViolationBadgeProps) {
  if (violations.length === 0) return null;

  const isBlocking = severity === 'blocking';

  // Usa il primo ruleId come testid (solitamente uno per cella)
  const primaryRuleId = violations[0]?.ruleId ?? 'unknown';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={[
            'inline-flex items-center justify-center rounded-full p-0.5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            isBlocking
              ? 'text-red-600 focus-visible:ring-red-500'
              : 'text-amber-500 focus-visible:ring-amber-400',
          ].join(' ')}
          aria-label={`${isBlocking ? 'Violazione bloccante' : 'Avviso'}: ${violations.map((v) => v.message).join(', ')}`}
          data-testid={`violation-badge-${primaryRuleId}`}
        >
          {isBlocking ? (
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <ul className="space-y-0.5" role="list">
          {violations.map((v) => (
            <li key={v.ruleId} className="text-xs">
              <span className="font-semibold">{v.ruleId}:</span> {v.message}
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
