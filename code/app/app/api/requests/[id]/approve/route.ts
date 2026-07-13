/**
 * app/api/requests/[id]/approve/route.ts — Approva richiesta (TSK-004).
 *
 * POST /api/requests/[id]/approve
 *   - Admin only (T-SEC-05).
 *   - Imposta status → 'approved', resolvedBy, resolvedAt.
 *   - Stub per l'applicazione degli effetti (TSK-006).
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

  // Solo admin può approvare (T-SEC-05)
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  // TODO TSK-006: validate RB-16 — solo richieste in stato 'sent' o 'awaiting_colleague'
  // TODO TSK-006: applicare gli effetti dell'approvazione (crea assenza, swap, ecc.)

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
      status: 'approved',
      resolvedBy: session.user.id as string,
      resolvedAt: new Date(),
      resolvedNotes: parsed.data.notes ?? null,
    })
    .where(eq(requests.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.approve',
    entityType: 'request',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  // SSE TSK-008: notifica il dipendente richiedente dell'approvazione
  emitToUser(existing.userId, {
    type: 'request.approved',
    payload: { requestId: id },
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.ok(updated);
}
