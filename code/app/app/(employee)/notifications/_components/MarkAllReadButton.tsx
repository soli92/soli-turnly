'use client';

/**
 * app/(employee)/notifications/_components/MarkAllReadButton.tsx (TSK-028)
 *
 * Pulsante "Segna tutte come lette" per il centro notifiche.
 *
 * Click → PATCH /api/notifications/read-all → invalida query ['notifications']
 * in modo che sia la pagina notifiche sia NotificationBell aggiornino il badge.
 *
 * RF-N: MarkAllReadButton.click → badge non lette torna a 0 sia in pagina sia in NotificationBell.
 */

import { useMarkAllRead } from '@/hooks/useNotificationMutations';
import { Button } from '@/components/ui/button';

export function MarkAllReadButton() {
  const mutation = useMarkAllRead();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      aria-label="Segna tutte le notifiche come lette"
    >
      {mutation.isPending ? 'In corso...' : 'Segna tutte come lette'}
    </Button>
  );
}
