/**
 * app/api/notifications/[id]/read/route.ts — Segna notifica come letta (TSK-004).
 *
 * PATCH /api/notifications/[id]/read
 *   - Imposta readAt = now() sulla notifica specificata.
 *   - Dipendente può segnare solo le proprie notifiche.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================
// PATCH /api/notifications/[id]/read
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, id))
    .limit(1);

  if (!notification) return ApiResponse.notFound('Notifica non trovata');

  // Solo il destinatario può segnare come letta
  if (notification.userId !== session.user.id) return ApiResponse.forbidden();

  // Idempotente: se già letta, restituisce la notifica invariata
  if (notification.readAt !== null) return ApiResponse.ok(notification);

  const [updated] = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'notification.read',
    entityType: 'notification',
    entityId: id,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}
