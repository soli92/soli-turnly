'use client';

/**
 * hooks/useNotificationMutations.ts (TSK-028)
 *
 * Query key factory + mutation hooks per le notifiche.
 * Sostituisce le mutation duplicate in NotificationBell, NotificationItem e
 * MarkAllReadButton, e la magic-string ['notifications'] ripetuta in 8+ punti.
 *
 * Esportazioni:
 *   - notificationKeys  — factory immutabile per le query key
 *   - useMarkRead()     — mutation PATCH /api/notifications/[id]/read
 *   - useMarkAllRead()  — mutation PATCH /api/notifications/read-all
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const notificationKeys = {
  /** Chiave radice — invalida sia la campanella sia il centro notifiche. */
  all: () => ['notifications'] as const,
  /** Chiave preview campanella: ['notifications', 'list'] */
  list: () => [...notificationKeys.all(), 'list'] as const,
  /** Chiave infinite scroll centro notifiche: ['notifications', 'center'] */
  center: () => [...notificationKeys.all(), 'center'] as const,
} as const;

// ---------------------------------------------------------------------------
// API helpers (private)
// ---------------------------------------------------------------------------

async function markNotificationReadApi(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Errore mark-read: ${res.status}`);
}

async function markAllReadApi(): Promise<{ updated: number }> {
  const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
  if (!res.ok) throw new Error(`Errore mark-all-read: ${res.status}`);
  return res.json() as Promise<{ updated: number }>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * useMarkRead — segna una singola notifica come letta.
 * onSuccess invalida notificationKeys.all() → aggiorna campanella + centro.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationReadApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}

/**
 * useMarkAllRead — segna tutte le notifiche come lette.
 * onSuccess invalida notificationKeys.all() → aggiorna campanella + centro.
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllReadApi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
    },
  });
}
