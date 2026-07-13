/**
 * app/api/requests/[id]/route.ts — GET, PATCH singola richiesta (TSK-004).
 *
 * GET   /api/requests/[id] — Proprietario o admin.
 * PATCH /api/requests/[id] — Proprietario (se in bozza) o admin.
 * DELETE /api/requests/[id] — Stub (annullamento via /cancel).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { requestPatchSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================
// GET /api/requests/[id]
// =============================================================

export async function GET(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [request] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!request) return ApiResponse.notFound('Richiesta non trovata');

  // Solo il proprietario o un admin può vedere la richiesta
  if (session.user.role !== 'admin' && request.userId !== session.user.id) {
    return ApiResponse.forbidden();
  }

  return ApiResponse.ok(request);
}

// =============================================================
// PATCH /api/requests/[id]
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  // Solo proprietario o admin
  if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
    return ApiResponse.forbidden();
  }

  // TODO TSK-006: validate RB-16 — dipendente può modificare solo se status = 'draft'
  // TODO TSK-006: validare transizioni di stato consentite per il ruolo

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = requestPatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const [updated] = await db
    .update(requests)
    .set({
      payload: parsed.data.payload as Record<string, unknown> | null | undefined,
      resolvedNotes: parsed.data.resolvedNotes,
    })
    .where(eq(requests.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.submit',
    entityType: 'request',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/requests/[id]
// =============================================================

export async function DELETE(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  if (session.user.role !== 'admin' && existing.userId !== session.user.id) {
    return ApiResponse.forbidden();
  }

  // TODO TSK-006: solo admin può eliminare fisicamente; dipendente usa /cancel
  // Per ora stub: solo admin elimina fisicamente
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  await db.delete(requests).where(eq(requests.id, id));

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.cancel',
    entityType: 'request',
    entityId: id,
    before: existing,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ deleted: true });
}
