/**
 * app/api/requests/[id]/reject/route.ts — Rifiuta richiesta (TSK-004).
 *
 * POST /api/requests/[id]/reject
 *   - Admin only (T-SEC-05).
 *   - Imposta status → 'rejected', resolvedBy, resolvedAt, resolvedNotes.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { resolveRequestSchema } from '@/lib/zod';
import { emitToUser } from '@/lib/sse/emit';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // Solo admin può rifiutare (T-SEC-05)
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  // TODO TSK-006: validate RB-16 — solo richieste in stato 'sent' o 'awaiting_colleague'
  // TODO TSK-006: notificare il dipendente (TSK-008)

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = resolveRequestSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const [updated] = await db
    .update(requests)
    .set({
      status: 'rejected',
      resolvedBy: session.user.id as string,
      resolvedAt: new Date(),
      resolvedNotes: parsed.data.notes ?? null,
    })
    .where(eq(requests.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.reject',
    entityType: 'request',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  // SSE TSK-008: notifica il dipendente richiedente del rifiuto
  emitToUser(existing.userId, {
    type: 'request.rejected',
    payload: { requestId: id, notes: parsed.data.notes ?? null },
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.ok(updated);
}
