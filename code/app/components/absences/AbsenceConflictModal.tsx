'use client';

/**
 * components/absences/AbsenceConflictModal.tsx — Dialog conflict resolution (TSK-017).
 *
 * Aperto dal AbsenceForm quando il dry-run (`check-conflicts`) restituisce turni.
 * Mostra il numero di turni in conflitto e la ConflictShiftList per le azioni.
 *
 * Flusso:
 *   1. AbsenceForm chiama check-conflicts → riceve N turni
 *   2. Apre questo modal con i turni + i dati del form
 *   3. L'admin sceglie per ogni turno: Annulla | Mantieni | Riassegna
 *   4. "Conferma registrazione" → POST /api/admin/absences con conflictResolutions[]
 *   5. Modal si chiude → toast success → invalidate queries
 *
 * RF-G CA2: i turni non vengono eliminati silenziosamente — sempre mostrati con azioni.
 *
 * Accessibility: WCAG 2.2 AA
 * - Dialog con focus trap (Radix)
 * - aria-describedby su DialogDescription
 * - Bottone conferma disabilitato se risoluzioni "riassegna" incomplete
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConflictShiftList } from './ConflictShiftList';

import type { ShiftConflict } from '@/app/api/admin/absences/check-conflicts/route';
import type { AbsenceAdminWithResolutionsInput, ConflictResolution } from '@/lib/zod';
import { useCreateAbsence } from '@/hooks/useAbsences';
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbsenceConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Turni in conflitto restituiti dal dry-run */
  conflicts: ShiftConflict[];

  /** Dati del form assenza (già validati) — da completare con le risoluzioni */
  absenceData: Omit<AbsenceAdminWithResolutionsInput, 'conflictResolutions'>;

  /** Lista utenti per il Select riassegna */
  users: Pick<UserRow, 'id' | 'firstName' | 'lastName'>[];

  /** Callback invocata dopo registrazione avvenuta con successo */
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AbsenceConflictModal({
  open,
  onOpenChange,
  conflicts,
  absenceData,
  users,
  onSuccess,
}: AbsenceConflictModalProps) {
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([]);
  const createAbsence = useCreateAbsence();

  // Verifica che tutte le "riassegna" abbiano un userId sostituto
  const isResolutionsComplete = resolutions.every(
    (r) => r.action !== 'riassegna' || Boolean(r.reassignToUserId)
  );

  async function handleConfirm() {
    if (!isResolutionsComplete) return;

    try {
      await createAbsence.mutateAsync({
        ...absenceData,
        conflictResolutions: resolutions,
      });
      onOpenChange(false);
      onSuccess();
    } catch {
      // errore visualizzato nel pulsante / alert mutation.error
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!createAbsence.isPending) onOpenChange(o);
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        aria-describedby="conflict-modal-description"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <DialogTitle>
              {conflicts.length === 1
                ? 'Trovato 1 turno in conflitto'
                : `Trovati ${conflicts.length} turni in conflitto`}
            </DialogTitle>
          </div>
          <DialogDescription id="conflict-modal-description">
            Il dipendente ha turni pianificati nelle date dell&apos;assenza (RF-G CA2). Scegli per
            ciascun turno come procedere prima di confermare la registrazione.
          </DialogDescription>
        </DialogHeader>

        {/* Lista conflitti con azioni */}
        <div className="my-2">
          <ConflictShiftList
            conflicts={conflicts}
            users={users}
            onResolutionsChange={setResolutions}
          />
        </div>

        {/* Errore mutation */}
        {createAbsence.isError && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {createAbsence.error?.message ?? 'Si è verificato un errore durante la registrazione.'}
          </p>
        )}

        {/* Avviso risoluzioni incomplete */}
        {!isResolutionsComplete && (
          <p role="status" className="mt-1 text-xs text-amber-600">
            Seleziona un dipendente sostituto per tutte le azioni &quot;Riassegna&quot; per
            procedere.
          </p>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAbsence.isPending}
          >
            Annulla
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={createAbsence.isPending || !isResolutionsComplete}
            aria-disabled={!isResolutionsComplete}
          >
            {createAbsence.isPending ? 'Registrazione…' : 'Conferma registrazione'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
