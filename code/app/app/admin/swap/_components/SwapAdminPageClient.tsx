'use client';

/**
 * app/(admin)/swap/_components/SwapAdminPageClient.tsx — TSK-026.
 *
 * Client Component orchestratore: state machine selezione → anteprima → conferma.
 *
 * Stati:
 *   selecting   → admin sta selezionando i due turni
 *   previewing  → entrambi selezionati, SwapImpactPreview carica automaticamente
 *   confirming  → solo avvisi (nessuna blocking), dialogo conferma aperto (RF-F CA2)
 *   executing   → API call in corso
 *   done        → swap eseguito con successo
 *
 * Layout:
 *   - Mobile (375px): pannelli A e B in colonna, anteprima sotto
 *   - Desktop (1280px): pannelli A e B affiancati, anteprima sotto
 *
 * RF-F, RB-10, AC: tutti i criteri del TSK.
 */

import { useState } from 'react';
import { CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwapPreview, useExecuteSwap } from '@/hooks/useSwap';
import type { ShiftSearchResult } from '@/hooks/useSwap';

import { ShiftSearchPanel } from './ShiftSearchPanel';
import { SelectedShiftCard } from './SelectedShiftCard';
import { SwapImpactPreview } from './SwapImpactPreview';
import { SwapConfirmDialog } from './SwapConfirmDialog';

interface UserMinimal {
  id: string;
  firstName: string;
  lastName: string;
}

interface SelectedShiftState {
  shift: ShiftSearchResult;
  user: UserMinimal;
}

interface SwapAdminPageClientProps {
  users: UserMinimal[];
}

export function SwapAdminPageClient({ users }: SwapAdminPageClientProps) {
  // Turni selezionati (null = non ancora selezionato)
  const [selectionA, setSelectionA] = useState<SelectedShiftState | null>(null);
  const [selectionB, setSelectionB] = useState<SelectedShiftState | null>(null);

  // Dialog conferma (aperto quando solo warnings, nessuna blocking)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Stato esito finale
  const [successSwapId, setSuccessSwapId] = useState<string | null>(null);

  const shiftAId = selectionA?.shift.id ?? null;
  const shiftBId = selectionB?.shift.id ?? null;
  const bothSelected = Boolean(shiftAId) && Boolean(shiftBId) && shiftAId !== shiftBId;

  // Carica anteprima (abilitata solo quando entrambi i turni sono selezionati)
  const { data: previewData, isLoading: previewLoading } = useSwapPreview(shiftAId, shiftBId);

  const executeSwap = useExecuteSwap();

  // Stessa persona selezionata per A e B
  const sameUser = selectionA && selectionB && selectionA.user.id === selectionB.user.id;

  // Determina se lo swap è eseguibile (nessuna blocking violation)
  const hasBlocking = (previewData?.blocking.length ?? 0) > 0;
  const hasWarnings = (previewData?.warnings.length ?? 0) > 0;
  const canExecute = bothSelected && !previewLoading && !hasBlocking && !sameUser;

  function handleShiftSelectA(shift: ShiftSearchResult, user: UserMinimal) {
    setSelectionA({ shift, user });
  }

  function handleShiftSelectB(shift: ShiftSearchResult, user: UserMinimal) {
    setSelectionB({ shift, user });
  }

  function handleClearA() {
    setSelectionA(null);
  }

  function handleClearB() {
    setSelectionB(null);
  }

  function handleExecuteClick() {
    if (!shiftAId || !shiftBId) return;

    if (hasWarnings && !hasBlocking) {
      // RF-F CA2: apre il dialogo di conferma
      setConfirmDialogOpen(true);
      return;
    }

    // Nessun warning e nessuna blocking: esecuzione diretta
    doExecuteSwap(false);
  }

  function doExecuteSwap(confirm: boolean) {
    if (!shiftAId || !shiftBId) return;

    executeSwap.mutate(
      { shiftIdA: shiftAId, shiftIdB: shiftBId, confirm },
      {
        onSuccess: (result) => {
          setConfirmDialogOpen(false);
          if (result.outcome === 'executed') {
            setSuccessSwapId(result.swapOperationId);
            // Reset selezione
            setSelectionA(null);
            setSelectionB(null);
          }
        },
        onError: () => {
          setConfirmDialogOpen(false);
        },
      }
    );
  }

  function handleReset() {
    setSuccessSwapId(null);
    setSelectionA(null);
    setSelectionB(null);
    executeSwap.reset();
  }

  // Stato: swap eseguito con successo
  if (successSwapId) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-4 rounded-lg border border-green-200 bg-green-50 px-6 py-10 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-green-800">Scambio eseguito</h2>
          <p className="mt-1 text-sm text-green-700">I turni sono stati scambiati con successo.</p>
          <p className="mt-0.5 text-xs text-green-600">
            ID operazione: <code>{successSwapId}</code>
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          Nuovo scambio
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Errore validazione client — stessi turni */}
      {sameUser && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          I turni devono appartenere a dipendenti diversi.
        </div>
      )}

      {/* Errore esecuzione */}
      {executeSwap.isError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {executeSwap.error instanceof Error
            ? executeSwap.error.message
            : "Errore durante l'esecuzione dello scambio."}
        </div>
      )}

      {/* Layout pannelli: colonna su mobile, affiancati su desktop */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pannello A */}
        <section
          aria-labelledby="panel-a-title"
          className="border-border rounded-lg border bg-white p-4 shadow-sm"
        >
          <h2 id="panel-a-title" className="mb-4 text-sm font-semibold text-gray-900">
            Turno A
          </h2>

          {/* Scheda turno selezionato */}
          <div className="mb-4">
            <SelectedShiftCard
              label="Turno A"
              shift={selectionA?.shift ?? null}
              user={selectionA?.user ?? null}
              onClear={handleClearA}
            />
          </div>

          {/* Pannello ricerca */}
          <ShiftSearchPanel
            label="Dipendente A"
            users={users}
            selectedShiftId={shiftAId}
            onShiftSelect={handleShiftSelectA}
          />
        </section>

        {/* Pannello B */}
        <section
          aria-labelledby="panel-b-title"
          className="border-border rounded-lg border bg-white p-4 shadow-sm"
        >
          <h2 id="panel-b-title" className="mb-4 text-sm font-semibold text-gray-900">
            Turno B
          </h2>

          {/* Scheda turno selezionato */}
          <div className="mb-4">
            <SelectedShiftCard
              label="Turno B"
              shift={selectionB?.shift ?? null}
              user={selectionB?.user ?? null}
              onClear={handleClearB}
            />
          </div>

          {/* Pannello ricerca */}
          <ShiftSearchPanel
            label="Dipendente B"
            users={users}
            selectedShiftId={shiftBId}
            onShiftSelect={handleShiftSelectB}
          />
        </section>
      </div>

      {/* Anteprima impatto — caricamento automatico */}
      {bothSelected && !sameUser && (
        <div className="border-border rounded-lg border bg-white p-4 shadow-sm">
          <SwapImpactPreview shiftAId={shiftAId} shiftBId={shiftBId} />
        </div>
      )}

      {/* Pulsante esecuzione */}
      {bothSelected && !sameUser && (
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!canExecute || executeSwap.isPending}
            onClick={handleExecuteClick}
            className="min-w-[160px]"
            aria-busy={executeSwap.isPending}
          >
            {executeSwap.isPending ? (
              'Esecuzione…'
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-4 w-4" aria-hidden="true" />
                {hasWarnings ? 'Esegui con avvisi' : 'Esegui scambio'}
              </>
            )}
          </Button>
        </div>
      )}

      {/* Dialog conferma (solo avvisi — RF-F CA2) */}
      <SwapConfirmDialog
        open={confirmDialogOpen}
        warnings={previewData?.warnings ?? []}
        isPending={executeSwap.isPending}
        onConfirm={() => doExecuteSwap(true)}
        onCancel={() => setConfirmDialogOpen(false)}
      />
    </div>
  );
}
