/**
 * app/api/notifications/read-all/route.ts — Segna tutte le notifiche come lette (TSK-028).
 *
 * PATCH /api/notifications/read-all
 *   - Imposta readAt = now() su tutte le notifiche non lette dell'utente autenticato.
 *   - Filtra sempre per userId = session.user.id (RF-N CA3: sicurezza IDOR).
 *   - Risponde { updated: N } dove N è il numero di notifiche aggiornate.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';

// =============================================================
// PATCH /api/notifications/read-all
// =============================================================

export async function PATCH(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const now = new Date();

  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, session.user.id as string), isNull(notifications.readAt)))
    .returning({ id: notifications.id });

  if (updated.length > 0) {
    await insertAuditLog({
      actorId: session.user.id as string,
      action: 'notification.read_all',
      entityType: 'notification',
      entityId: session.user.id as string,
      after: { updated: updated.length },
      ip: extractIp(req),
      userAgent: extractUserAgent(req),
    });
  }

  return ApiResponse.ok({ updated: updated.length });
}
