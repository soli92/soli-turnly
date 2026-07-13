/**
 * app/api/admin/absences/[id]/route.ts — GET, PATCH, DELETE assenza (admin) (TSK-004).
 *
 * GET    /api/admin/absences/[id] — Dettaglio assenza.
 * PATCH  /api/admin/absences/[id] — Modifica assenza (status, note).
 * DELETE /api/admin/absences/[id] — Elimina assenza (admin only).
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { absences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

const absencePatchSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  notes: z.string().max(500).optional().nullable(),
});

// =============================================================
// GET /api/admin/absences/[id]
// =============================================================

export async function GET(_req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [absence] = await db.select().from(absences).where(eq(absences.id, id)).limit(1);
  if (!absence) return ApiResponse.notFound('Assenza non trovata');

  return ApiResponse.ok(absence);
}

// =============================================================
// PATCH /api/admin/absences/[id]
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(absences).where(eq(absences.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Assenza non trovata');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = absencePatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const setData = {
    ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    ...(parsed.data.status === 'approved'
      ? { approvedBy: session.user.id as string, approvedAt: new Date() }
      : {}),
  };

  const [updated] = await db
    .update(absences)
    .set(setData)
    .where(eq(absences.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'absence.update',
    entityType: 'absence',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/admin/absences/[id]
// =============================================================

export async function DELETE(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db.select().from(absences).where(eq(absences.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Assenza non trovata');

  await db.delete(absences).where(eq(absences.id, id));

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'absence.delete',
    entityType: 'absence',
    entityId: id,
    before: existing,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ deleted: true });
}
