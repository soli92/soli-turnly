'use client';

/**
 * app/(employee)/notifications/_components/NotificationCenterClient.tsx (TSK-028)
 *
 * Client component per il centro notifiche completo.
 * Gestisce:
 *   - SSE subscription via useNotifications() — invalida la query a ogni evento
 *   - Paginazione infinite scroll tramite TanStack Query useInfiniteQuery
 *   - "Carica altre" button quando c'è una pagina successiva
 *
 * Chiave query ['notifications', 'center'] separata da ['notifications'] usata
 * da NotificationBell: la chiave parziale ['notifications'] invalida entrambe.
 *
 * RF-N CA1/CA2/CA3: gli eventi SSE scatenano il refetch; il server filtra
 * sempre per userId = session.user.id.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationKeys } from '@/hooks/useNotificationMutations';
import { NotificationItem } from './NotificationItem';
import { NotificationEmptyState } from './NotificationEmptyState';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/db/schema';

// ---------------------------------------------------------------------------
// Tipi API
// ---------------------------------------------------------------------------

interface NotificationsPage {
  data: Notification[];
  unreadCount: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchNotificationsPage({
  pageParam,
}: {
  pageParam: number;
}): Promise<NotificationsPage> {
  const res = await fetch(`/api/notifications?page=${pageParam}&limit=20`);
  if (!res.ok) throw new Error(`Errore API notifiche: ${res.status}`);
  return res.json() as Promise<NotificationsPage>;
}

// ---------------------------------------------------------------------------
// NotificationCenterClient
// ---------------------------------------------------------------------------

export function NotificationCenterClient() {
  // SSE subscription — invalida ['notifications'] a ogni evento ricevuto
  useNotifications();

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: notificationKeys.center(),
      queryFn: fetchNotificationsPage,
      initialPageParam: 1,
      getNextPageParam: (lastPage: NotificationsPage) => {
        // Nessuna pagina successiva se la pagina corrente è parziale
        if (lastPage.data.length < lastPage.limit) return undefined;
        return lastPage.page + 1;
      },
      staleTime: 30_000,
    });

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento notifiche">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-gray-100 bg-gray-50"
          />
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento notifiche:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Flatten pages
  // ---------------------------------------------------------------------------

  const allNotifications = data?.pages.flatMap((p) => p.data) ?? [];

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (allNotifications.length === 0) {
    return <NotificationEmptyState />;
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <ul className="space-y-2" role="list" aria-label="Lista notifiche">
        {allNotifications.map((n) => (
          <NotificationItem key={n.id} notification={n} />
        ))}
      </ul>

      {/* Paginazione — "Carica altre" button */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            aria-label="Carica altre notifiche"
          >
            {isFetchingNextPage ? 'Caricamento...' : 'Carica altre'}
          </Button>
        </div>
      )}
    </div>
  );
}
