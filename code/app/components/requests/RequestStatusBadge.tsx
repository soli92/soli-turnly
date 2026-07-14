'use client';

/**
 * components/requests/RequestStatusBadge.tsx — Pill colorato per lo stato richiesta.
 *
 * Copre tutti i valori dell'enum `requestStatusEnum` del DB:
 *   draft | sent | awaiting_colleague | approved | rejected | cancelled | applied
 *
 * Accessibility (WCAG 2.2 AA):
 *   - `role="status"` + `aria-label` con testo esteso per screen reader.
 *   - Colore non è l'unico mezzo di comunicazione (testo visibile in ogni badge).
 *
 * data-testid: request-status-badge
 */

import type { RequestStatus } from '@/hooks/useRequests';

// ---------------------------------------------------------------------------
// Config colori per stato
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  className: string;
  dotClassName: string;
  ariaLabel: string;
}

const STATUS_CONFIG: Record<RequestStatus, StatusConfig> = {
  draft: {
    label: 'Bozza',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    dotClassName: 'bg-gray-400',
    ariaLabel: 'Stato: bozza',
  },
  sent: {
    label: 'In attesa',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClassName: 'bg-amber-500',
    ariaLabel: 'Stato: in attesa di approvazione',
  },
  awaiting_colleague: {
    label: 'Attesa collega',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClassName: 'bg-blue-500',
    ariaLabel: "Stato: in attesa dell'accettazione del collega",
  },
  approved: {
    label: 'Approvata',
    className: 'bg-green-50 text-green-700 border-green-200',
    dotClassName: 'bg-green-500',
    ariaLabel: 'Stato: approvata',
  },
  rejected: {
    label: 'Rifiutata',
    className: 'bg-red-50 text-red-700 border-red-200',
    dotClassName: 'bg-red-500',
    ariaLabel: 'Stato: rifiutata',
  },
  cancelled: {
    label: 'Annullata',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    dotClassName: 'bg-gray-400',
    ariaLabel: 'Stato: annullata',
  },
  applied: {
    label: 'Applicata',
    className: 'bg-teal-50 text-teal-700 border-teal-200',
    dotClassName: 'bg-teal-500',
    ariaLabel: 'Stato: applicata',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestStatusBadgeProps {
  status: RequestStatus;
  size?: 'sm' | 'md';
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestStatusBadge({ status, size = 'md' }: RequestStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;

  const sizeClassName =
    size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs font-medium';

  return (
    <span
      data-testid="request-status-badge"
      role="status"
      aria-label={config.ariaLabel}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border',
        sizeClassName,
        config.className,
      ].join(' ')}
    >
      <span
        className={['h-1.5 w-1.5 rounded-full', config.dotClassName].join(' ')}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}
