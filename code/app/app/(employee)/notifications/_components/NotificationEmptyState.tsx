/**
 * app/(employee)/notifications/_components/NotificationEmptyState.tsx (TSK-028)
 *
 * Empty state per il centro notifiche: mostrato quando la lista è vuota.
 * Accessibile: testo leggibile, icona decorativa aria-hidden.
 */

import { BellOff } from 'lucide-react';

export function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BellOff className="mb-4 h-12 w-12 text-gray-300" aria-hidden="true" />
      <p className="text-base font-medium text-gray-500">Nessuna notifica</p>
      <p className="mt-1 text-sm text-gray-400">Le notifiche arriveranno qui in tempo reale</p>
    </div>
  );
}
