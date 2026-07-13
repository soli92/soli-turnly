'use client';

/**
 * components/notifications/NotificationBell.tsx — Campanella notifiche navbar (TSK-008).
 *
 * Mostra l'icona campanella con badge numerico delle notifiche non lette.
 * Click → Popover con le ultime 5 notifiche; click su singola notifica → mark as read.
 *
 * Dipendenze:
 *   - TanStack Query (useQuery, useMutation) — fetch e aggiornamento notifiche
 *   - useNotifications() — apre SSE stream, invalida query al ricezione eventi
 *   - @radix-ui/react-popover — dropdown (Popover installato come dep. nativa)
 *   - lucide-react — icona Bell
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/db/schema';

// ---------------------------------------------------------------------------
// Tipi API
// ---------------------------------------------------------------------------

interface NotificationsApiResponse {
  data: Notification[];
  unreadCount: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchNotifications(): Promise<NotificationsApiResponse> {
  const res = await fetch('/api/notifications?limit=5');
  if (!res.ok) throw new Error(`Errore API notifiche: ${res.status}`);
  return res.json() as Promise<NotificationsApiResponse>;
}

async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error(`Errore mark-read: ${res.status}`);
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const queryClient = useQueryClient();

  // SSE subscription — invalida ['notifications'] al ricezione di eventi
  useNotifications();

  // Query lista notifiche (ultime 5)
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });

  // Mutation mark-as-read
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = data?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Notifiche — ${unreadCount} non lette`}
          className="relative inline-flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold leading-none text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-md border border-gray-200 bg-white shadow-lg outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">
              Notifiche
            </span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {unreadCount} non {unreadCount === 1 ? 'letta' : 'lette'}
              </span>
            )}
          </div>

          {/* Lista */}
          <ul className="divide-y divide-gray-100" role="list">
            {isLoading && (
              <li className="px-4 py-3 text-sm text-gray-500">
                Caricamento...
              </li>
            )}

            {!isLoading && notifications.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">
                Nessuna notifica
              </li>
            )}

            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.readAt) {
                      markRead.mutate(n.id);
                    }
                  }}
                  className={[
                    'w-full px-4 py-3 text-left transition-colors hover:bg-gray-50',
                    !n.readAt ? 'bg-indigo-50' : '',
                  ].join(' ')}
                >
                  <p
                    className={[
                      'text-sm',
                      !n.readAt
                        ? 'font-semibold text-gray-900'
                        : 'text-gray-700',
                    ].join(' ')}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {n.body}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-400">
                    {new Date(n.createdAt).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {/* Arrow decorativo */}
          <Popover.Arrow className="fill-white drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
