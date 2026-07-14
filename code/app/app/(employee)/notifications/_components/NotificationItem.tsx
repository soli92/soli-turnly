'use client';

/**
 * app/(employee)/notifications/_components/NotificationItem.tsx (TSK-028)
 *
 * Singola notifica nel centro notifiche.
 *
 * Comportamento:
 *   - Sfondo indigo-50 se non letta; click → segna come letta + naviga all'entità (se link presente).
 *   - Routing entità: request → /requests/:id, shift → /calendar, absence → /requests.
 *
 * Accessibilità (WCAG 2.2 AA, RF-N):
 *   - role="listitem" su ogni item.
 *   - <time datetime="ISO"> per i timestamp leggibili dagli screen reader.
 *   - aria-label sul badge "Non letta" per screen reader.
 */

import Link from 'next/link';
import { useMarkRead } from '@/hooks/useNotificationMutations';
import type { Notification } from '@/db/schema';

// ---------------------------------------------------------------------------
// Entity routing
// ---------------------------------------------------------------------------

function getEntityLink(n: Notification): string | null {
  if (!n.relatedEntityType || !n.relatedEntityId) return null;
  const map: Record<string, string> = {
    request: `/requests/${n.relatedEntityId}`,
    shift: `/calendar`,
    absence: `/requests`,
  };
  return map[n.relatedEntityType] ?? null;
}

// ---------------------------------------------------------------------------
// NotificationItem
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification: n }: NotificationItemProps) {
  const markRead = useMarkRead();

  const isUnread = !n.readAt;
  const entityLink = getEntityLink(n);
  const createdAtDate = new Date(n.createdAt);
  const isoString = createdAtDate.toISOString();
  const displayTime = createdAtDate.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleClick = () => {
    if (isUnread) markRead.mutate(n.id);
  };

  const containerClass = [
    'flex items-start gap-3 w-full rounded-lg border p-4 text-left transition-colors',
    isUnread
      ? 'bg-indigo-50 border-indigo-100 hover:bg-indigo-100'
      : 'bg-white border-gray-100 hover:bg-gray-50',
  ].join(' ');

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p
          className={[
            'text-sm break-words',
            isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
          ].join(' ')}
        >
          {n.title}
        </p>
        <p className="mt-0.5 text-xs break-words text-gray-500">{n.body}</p>
        <time dateTime={isoString} className="mt-1 block text-[11px] text-gray-400">
          {displayTime}
        </time>
      </div>
      {isUnread && (
        <span
          aria-label="Non letta"
          className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-indigo-500"
        />
      )}
    </>
  );

  if (entityLink) {
    return (
      <li role="listitem">
        <Link href={entityLink} onClick={handleClick} className={containerClass}>
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li role="listitem">
      <button type="button" onClick={handleClick} className={containerClass}>
        {body}
      </button>
    </li>
  );
}
