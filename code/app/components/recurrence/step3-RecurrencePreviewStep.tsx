'use client';

/**
 * components/recurrence/step3-RecurrencePreviewStep.tsx
 *
 * Step 3 del wizard ricorrenze: anteprima turni generati + report conflitti.
 *
 * Flusso:
 *   1. Al mounting chiama POST /api/admin/recurrence/preview (dry-run).
 *   2. Mostra il riepilogo: N turni da generare, M saltati assenza, K saltati festivi.
 *   3. Mostra RecurrenceConflictReport (collassabile per dipendente).
 *   4. Bottone "Genera" abilitato solo dopo preview caricata con successo.
 *   5. POST /api/admin/recurrence/generate → toast + onSuccess callback.
 *
 * RB-11: occorrenze con assenza approvata mostrate come "Saltata (assenza)".
 * RF-E CA1: preview mostra tutte le occorrenze incl. le saltate.
 *
 * Accessibility: WCAG 2.2 AA
 *   - aria-live="polite" su area risultati preview
 *   - aria-busy durante il caricamento
 *   - role="alert" per errori
 *   - Pulsante "Genera" con aria-disabled quando non pronto
 *
 * TSK-019, RF-E, RB-11
 */

import { useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecurrenceConflictReport } from './RecurrenceConflictReport';
import {
  usePreviewRecurrence,
  useGenerateRecurrence,
  type RecurrenceWizardPayload,
} from '@/hooks/useRecurrences';
import { useUsers } from '@/hooks/useUsers';
import { toast } from '@/lib/toast';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Step3Props {
  payload: RecurrenceWizardPayload;
  onBack: () => void;
  /** Chiamata dopo la generazione con successo. */
  onSuccess: (generated: number, skipped: number) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecurrencePreviewStep({ payload, onBack, onSuccess }: Step3Props) {
  const previewMutation = usePreviewRecurrence();
  const generateMutation = useGenerateRecurrence();
  const { data: users = [] } = useUsers();

  // Mappa userId → UserRow per i nomi nel report conflitti
  const userMap = useMemo(() => {
    const m = new Map<string, (typeof users)[0]>();
    for (const u of users) {
      m.set(u.id, u);
    }
    return m;
  }, [users]);

  // Avvia la preview al mounting (se non già in corso)
  useEffect(() => {
    if (previewMutation.status === 'idle') {
      previewMutation.mutate(payload);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Dati preview
  // ---------------------------------------------------------------------------

  const previewData = previewMutation.data;

  const turniTotali = previewData?.turni.length ?? 0;
  const turniDaGenerare = previewData?.turni.filter((t) => !t.skipped).length ?? 0;
  const saltatiAssenza = previewData?.turni.filter((t) => t.skipReason === 'absence').length ?? 0;
  const saltatiFestivi = previewData?.turni.filter((t) => t.skipReason === 'holiday').length ?? 0;
  const saltatiOverlap = previewData?.turni.filter((t) => t.skipReason === 'overlap').length ?? 0;

  const isPreviewReady = previewMutation.isSuccess;
  const isPreviewLoading = previewMutation.isPending;
  const isPreviewError = previewMutation.isError;
  const isGenerating = generateMutation.isPending;
  const isGenerateDone = generateMutation.isSuccess;

  // ---------------------------------------------------------------------------
  // Genera
  // ---------------------------------------------------------------------------

  function handleGenerate() {
    if (!isPreviewReady || isGenerating || isGenerateDone) return;

    generateMutation.mutate(payload, {
      onSuccess: (data) => {
        toast.success(
          `${data.generated} turno${data.generated !== 1 ? 'i' : ''} generato${data.generated !== 1 ? 'i' : ''}, ${data.skipped} saltato${data.skipped !== 1 ? 'i' : ''}.`
        );
        onSuccess(data.generated, data.skipped);
      },
      onError: (err) => {
        toast.error(`Errore nella generazione: ${err.message}`);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Ricarica preview
  // ---------------------------------------------------------------------------

  function handleReloadPreview() {
    previewMutation.reset();
    generateMutation.reset();
    previewMutation.mutate(payload);
  }

  // ---------------------------------------------------------------------------
  // Render: loading preview
  // ---------------------------------------------------------------------------

  if (isPreviewLoading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12"
        aria-busy="true"
        aria-label="Calcolo anteprima in corso"
      >
        <Loader2 className="text-primary h-8 w-8 animate-spin" aria-hidden="true" />
        <p className="text-sm text-gray-600">Calcolo anteprima turni…</p>
        <p className="text-xs text-gray-400">Verifico conflitti con assenze e festività.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: errore preview
  // ---------------------------------------------------------------------------

  if (isPreviewError) {
    return (
      <div className="space-y-4">
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Errore nel calcolo della preview</p>
              <p className="mt-1 text-red-700">
                {previewMutation.error?.message ?? 'Errore sconosciuto. Riprova.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Indietro
          </Button>
          <Button type="button" variant="outline" onClick={handleReloadPreview}>
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: preview caricata
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Riepilogo numerico */}
      <div aria-live="polite" aria-atomic="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Turni da generare" value={turniDaGenerare} highlight />
        <StatCard label="Totale occorrenze" value={turniTotali} />
        <StatCard label="Saltati (assenza)" value={saltatiAssenza} warn={saltatiAssenza > 0} />
        <StatCard
          label="Saltati (festivi + altro)"
          value={saltatiFestivi + saltatiOverlap}
          warn={saltatiFestivi + saltatiOverlap > 0}
        />
      </div>

      {/* Esito generazione (post-generate) */}
      {isGenerateDone && generateMutation.data && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <strong>{generateMutation.data.generated}</strong> turno
              {generateMutation.data.generated !== 1 ? 'i' : ''} generato
              {generateMutation.data.generated !== 1 ? 'i' : ''} con successo.
              {generateMutation.data.skipped > 0 && (
                <span className="ml-1 text-green-700">
                  {generateMutation.data.skipped} saltato
                  {generateMutation.data.skipped !== 1 ? 'i' : ''}.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Report conflitti */}
      {isPreviewReady && previewData && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Report conflitti</p>
          <RecurrenceConflictReport conflicts={previewData.conflicts} userMap={userMap} />
        </div>
      )}

      {/* Errore generate */}
      {generateMutation.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-medium">Errore nella generazione</p>
          <p className="mt-0.5 text-red-700">
            {generateMutation.error?.message ?? 'Errore sconosciuto.'}
          </p>
        </div>
      )}

      {/* Navigazione */}
      <div className="flex justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isGenerating || isGenerateDone}
        >
          Indietro
        </Button>
        <div className="flex gap-2">
          {!isGenerateDone && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReloadPreview}
              disabled={isGenerating}
              aria-label="Ricalcola anteprima"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ricalcola
            </Button>
          )}
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!isPreviewReady || isGenerating || isGenerateDone}
            aria-disabled={!isPreviewReady || isGenerating || isGenerateDone}
            aria-describedby={!isPreviewReady ? 'generate-hint' : undefined}
          >
            {isGenerating && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isGenerating
              ? 'Generazione in corso…'
              : isGenerateDone
                ? 'Generazione completata'
                : `Genera ${turniDaGenerare} turno${turniDaGenerare !== 1 ? 'i' : ''}`}
          </Button>
        </div>
      </div>

      {!isPreviewReady && (
        <p id="generate-hint" className="sr-only">
          Il pulsante Genera è disabilitato finché la preview non è caricata.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight
          ? 'border-primary/30 bg-primary/5'
          : warn
            ? 'border-amber-200 bg-amber-50'
            : 'border-border bg-white'
      }`}
    >
      <p
        className={`text-2xl font-bold tabular-nums ${
          highlight ? 'text-primary' : warn ? 'text-amber-700' : 'text-gray-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs leading-tight text-gray-500">{label}</p>
    </div>
  );
}
