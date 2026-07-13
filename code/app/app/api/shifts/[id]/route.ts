/**
 * app/api/shifts/[id]/route.ts — GET, PATCH, DELETE singolo turno (TSK-004).
 *
 * GET    /api/shifts/[id]  — Admin o proprietario del turno.
 * PATCH  /api/shifts/[id]  — Admin only.
 * DELETE /api/shifts/[id]  — Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { shiftPatchSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================
// GET /api/shifts/[id]
// =============================================================

export async function GET(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [shift] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);

  if (!shift) return ApiResponse.notFound('Turno non trovato');

  // Dipendente può vedere solo i propri turni (T-SEC-01)
  if (session.user.role !== 'admin' && shift.userId !== session.user.id) {
    return ApiResponse.forbidden();
  }

  return ApiResponse.ok(shift);
}

// =============================================================
// PATCH /api/shifts/[id]
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // Solo admin può modificare turni
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Turno non trovato');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = shiftPatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const updateData = parsed.data;

  // TODO TSK-006: validate RB-01 (no sovrapposizione se startDt/endDt cambia)
  // TODO TSK-006: validate RB-03 (riposo minimo tra turni)

  const [updated] = await db
    .update(shifts)
    .set({
      ...updateData,
      startDt: updateData.startDt ? new Date(updateData.startDt) : undefined,
      endDt: updateData.endDt ? new Date(updateData.endDt) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(shifts.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.update',
    entityType: 'shift',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/shifts/[id]
// =============================================================

export async function DELETE(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // Solo admin può eliminare turni
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Turno non trovato');

  // TODO TSK-006: validate RB-05 (non eliminare turni confermati con preavviso < X ore)

  await db.delete(shifts).where(eq(shifts.id, id));

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.delete',
    entityType: 'shift',
    entityId: id,
    before: existing,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ deleted: true });
}
