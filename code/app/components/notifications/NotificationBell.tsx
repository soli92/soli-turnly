'use client';

/**
 * components/notifications/NotificationBell.tsx — Campanella notifiche navbar (TSK-008, TSK-028).
 *
 * Mostra l'icona campanella con badge numerico delle notifiche non lette.
 * Click → Popover con le ultime 5 notifiche; click su singola notifica → mark as read.
 *
 * TSK-028 aggiunge:
 *   - Pulsante "Segna tutte come lette" nell'header del Popover.
 *   - Link "Vedi tutte →" nel footer del Popover → naviga a /notifications.
 *
 * Dipendenze:
 *   - TanStack Query (useQuery, useMutation) — fetch e aggiornamento notifiche
 *   - useNotifications() — apre SSE stream, invalida query al ricezione eventi
 *   - @radix-ui/react-popover — dropdown (Popover installato come dep. nativa)
 *   - lucide-react — icona Bell
 *   - next/link — navigazione client-side verso /notifications
 */

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationKeys, useMarkRead, useMarkAllRead } from '@/hooks/useNotificationMutations';
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

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell() {
  // SSE subscription — invalida notificationKeys.all() a ogni evento ricevuto
  useNotifications();

  // Query lista notifiche (ultime 5)
  const { data, isLoading } = useQuery({
    queryKey: notificationKeys.all(),
    queryFn: fetchNotifications,
    staleTime: 30_000,
  });

  // Mutation hooks (TSK-028) — deduplicati via useNotificationMutations
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = data?.unreadCount ?? 0;
  const notificationsList = data?.data ?? [];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Notifiche — ${unreadCount} non ${unreadCount === 1 ? 'letta' : 'lette'}`}
          className="relative inline-flex items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:ring-inset"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none font-semibold text-white"
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
            <span className="text-sm font-semibold text-gray-900">Notifiche</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {unreadCount} non {unreadCount === 1 ? 'letta' : 'lette'}
                  </span>
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="text-xs text-indigo-600 hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Segna tutte le notifiche come lette"
                  >
                    Segna tutte
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lista */}
          <ul className="divide-y divide-gray-100" role="list">
            {isLoading && <li className="px-4 py-3 text-sm text-gray-500">Caricamento...</li>}

            {!isLoading && notificationsList.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">Nessuna notifica</li>
            )}

            {notificationsList.map((n) => (
              <li key={n.id} role="listitem">
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
                      !n.readAt ? 'font-semibold text-gray-900' : 'text-gray-700',
                    ].join(' ')}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{n.body}</p>
                  <time
                    dateTime={new Date(n.createdAt).toISOString()}
                    className="mt-1 block text-[10px] text-gray-400"
                  >
                    {new Date(n.createdAt).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </button>
              </li>
            ))}
          </ul>

          {/* Footer — link "Vedi tutte" (TSK-028) */}
          <div className="border-t border-gray-100 px-4 py-2">
            <Link
              href="/notifications"
              className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
            >
              Vedi tutte &rarr;
            </Link>
          </div>

          {/* Arrow decorativo */}
          <Popover.Arrow className="fill-white drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
