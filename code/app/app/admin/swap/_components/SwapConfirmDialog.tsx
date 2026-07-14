'use client';

/**
 * app/(admin)/swap/_components/SwapConfirmDialog.tsx — TSK-026.
 *
 * Dialog di conferma mostrato quando lo swap ha solo avvisi (nessuna blocking violation).
 * RF-F CA2: l'admin deve confermare esplicitamente prima che lo swap venga eseguito.
 *
 * Usa @radix-ui/react-alert-dialog tramite il wrapper shadcn.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import type { RuleViolation } from '@/lib/rules/types';

interface SwapConfirmDialogProps {
  open: boolean;
  warnings: RuleViolation[];
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SwapConfirmDialog({
  open,
  warnings,
  isPending,
  onConfirm,
  onCancel,
}: SwapConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
            Conferma scambio con avvisi
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="text-sm text-gray-600">
                Lo scambio è tecnicamente possibile ma presenta{' '}
                <strong>
                  {warnings.length} avvis{warnings.length === 1 ? 'o' : 'i'}
                </strong>
                . Vuoi procedere comunque?
              </p>

              {/* Lista avvisi compatta */}
              {warnings.length > 0 && (
                <ul className="mt-3 space-y-1.5" aria-label="Avvisi scambio">
                  {warnings.map((w, i) => (
                    <li
                      key={`${w.ruleId}-${i}`}
                      className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800"
                    >
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500"
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{w.ruleId}</strong>: {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isPending}>
            Annulla
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-yellow-600 text-white hover:bg-yellow-700 focus-visible:ring-yellow-500"
          >
            {isPending ? 'Esecuzione…' : 'Conferma scambio'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
