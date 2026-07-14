'use client';

/**
 * app/(admin)/swap/_components/SwapImpactPreview.tsx — TSK-026.
 *
 * Pannello anteprima impatto RB-10.
 * Caricamento automatico quando entrambi i turni sono selezionati (nessun click extra).
 *
 * Stati:
 *   - Idle (nessun turno selezionato): messaggio placeholder
 *   - Loading: skeleton
 *   - Error: messaggio errore
 *   - Success: SwapViolationSummary
 */

import { Loader2 } from 'lucide-react';
import { useSwapPreview } from '@/hooks/useSwap';
import { SwapViolationSummary } from './SwapViolationSummary';

interface SwapImpactPreviewProps {
  shiftAId: string | null;
  shiftBId: string | null;
}

export function SwapImpactPreview({ shiftAId, shiftBId }: SwapImpactPreviewProps) {
  const bothSelected = Boolean(shiftAId) && Boolean(shiftBId) && shiftAId !== shiftBId;

  const { data, isLoading, isError, error } = useSwapPreview(shiftAId, shiftBId);

  if (!bothSelected) {
    return (
      <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-400">
        Seleziona entrambi i turni per vedere l&apos;anteprima impatto.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Caricamento anteprima impatto"
        className="border-border flex items-center gap-3 rounded-lg border bg-white px-4 py-6"
      >
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
        <span className="text-sm text-gray-500">Calcolo impatto in corso…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"
      >
        {error instanceof Error ? error.message : 'Errore nel calcolo anteprima impatto.'}
      </div>
    );
  }

  if (!data) return null;

  return (
    <section aria-labelledby="impact-preview-title">
      <h3 id="impact-preview-title" className="mb-3 text-sm font-semibold text-gray-900">
        Anteprima impatto (RB-10)
      </h3>
      <SwapViolationSummary
        blocking={data.blocking}
        warnings={data.warnings}
        showInfo
        info={data.info}
      />
    </section>
  );
}
