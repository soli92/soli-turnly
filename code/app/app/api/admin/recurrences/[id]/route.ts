/**
 * app/api/admin/recurrences/[id]/route.ts — Operazioni su singola ricorrenza
 * (TSK-009, TSK-019).
 *
 * PATCH  /api/admin/recurrences/[id] — aggiorna campi ricorrenza
 * DELETE /api/admin/recurrences/[id] — soft delete (active: false)
 *
 * Admin only.
 *
 * Il soft delete imposta `active: false` senza cancellare la riga, in modo
 * che i turni già generati dalla ricorrenza restino nel DB e l'audit log
 * preservi la tracciabilità.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { recurrences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { recurrencePatchSchema } from '@/lib/zod';

// ---------------------------------------------------------------------------
// PATCH /api/admin/recurrences/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) return ApiResponse.badRequest('id: UUID non valido');

  const existing = await db.query.recurrences.findFirst({
    where: eq(recurrences.id, id),
  });
  if (!existing) return ApiResponse.notFound('Ricorrenza non trovata');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = recurrencePatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const [updated] = await db
    .update(recurrences)
    .set(parsed.data)
    .where(eq(recurrences.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.update',
    entityType: 'recurrence',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ ...updated });
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/recurrences/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  // Validazione UUID
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return ApiResponse.badRequest('id: UUID non valido');
  }

  // Verifica esistenza
  const existing = await db.query.recurrences.findFirst({
    where: eq(recurrences.id, id),
  });

  if (!existing) return ApiResponse.notFound('Ricorrenza non trovata');

  if (!existing.active) {
    return ApiResponse.conflict('Ricorrenza già disattivata');
  }

  // Soft delete: imposta active = false
  const [updated] = await db
    .update(recurrences)
    .set({ active: false })
    .where(eq(recurrences.id, id))
    .returning();

  // Audit log
  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.delete',
    entityType: 'recurrence',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ ...updated });
}
