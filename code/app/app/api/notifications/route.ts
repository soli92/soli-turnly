/**
 * app/api/notifications/route.ts — Lista notifiche utente (TSK-004).
 *
 * GET /api/notifications
 *   - Restituisce le notifiche dell'utente autenticato.
 *   - Non lette per prime (ORDER BY readAt NULLS FIRST, createdAt DESC).
 *   Query params: unreadOnly (boolean), page (default 1), limit (default 20).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';

// =============================================================
// GET /api/notifications
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';

  // Paginazione
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(notifications)
    .where(
      unreadOnly
        ? and(eq(notifications.userId, session.user.id as string), isNull(notifications.readAt))
        : eq(notifications.userId, session.user.id as string)
    )
    .orderBy(sql`${notifications.readAt} NULLS FIRST`, desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  // Conta non lette per l'inbox counter
  const unreadCount = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, session.user.id as string), isNull(notifications.readAt)));

  return ApiResponse.ok({
    data: rows,
    unreadCount: unreadCount.length,
    page,
    limit,
  });
}
