/**
 * app/api/shift-types/[id]/route.ts — PATCH, DELETE tipo turno (admin) (TSK-004).
 *
 * GET    /api/shift-types/[id] — Tutti gli utenti autenticati.
 * PATCH  /api/shift-types/[id] — Admin only.
 * DELETE /api/shift-types/[id] — Admin only (soft delete: active = false).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shiftTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { shiftTypePatchSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================
// GET /api/shift-types/[id]
// =============================================================

export async function GET(_req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [shiftType] = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.id, id))
    .limit(1);

  if (!shiftType) return ApiResponse.notFound('Tipo turno non trovato');

  return ApiResponse.ok(shiftType);
}

// =============================================================
// PATCH /api/shift-types/[id]
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.id, id))
    .limit(1);

  if (!existing) return ApiResponse.notFound('Tipo turno non trovato');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = shiftTypePatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const [updated] = await db
    .update(shiftTypes)
    .set(parsed.data)
    .where(eq(shiftTypes.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift_type.update',
    entityType: 'shift_type',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/shift-types/[id]
// =============================================================

export async function DELETE(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(shiftTypes)
    .where(eq(shiftTypes.id, id))
    .limit(1);

  if (!existing) return ApiResponse.notFound('Tipo turno non trovato');

  // Soft delete: imposta active = false per mantenere la storia dei turni
  const [updated] = await db
    .update(shiftTypes)
    .set({ active: false })
    .where(eq(shiftTypes.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift_type.delete',
    entityType: 'shift_type',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ deactivated: true });
}
