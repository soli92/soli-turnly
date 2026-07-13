/**
 * app/api/admin/users/[id]/route.ts — GET, PATCH, DELETE utente (admin) (TSK-004).
 *
 * GET    /api/admin/users/[id] — Dettaglio utente.
 * PATCH  /api/admin/users/[id] — Modifica utente (tutti i campi consentiti).
 * DELETE /api/admin/users/[id] — Soft delete (active = false).
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { adminUserPatchSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

const userSelectFields = {
  id: users.id,
  email: users.email,
  role: users.role,
  firstName: users.firstName,
  lastName: users.lastName,
  qualificationId: users.qualificationId,
  contractHours: users.contractHours,
  active: users.active,
  createdAt: users.createdAt,
};

// =============================================================
// GET /api/admin/users/[id]
// =============================================================

export async function GET(_req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [user] = await db
    .select(userSelectFields)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return ApiResponse.notFound('Utente non trovato');

  return ApiResponse.ok(user);
}

// =============================================================
// PATCH /api/admin/users/[id]
// =============================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing) return ApiResponse.notFound('Utente non trovato');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = adminUserPatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  // TODO TSK-006: validate RB-13 se email cambia (unicità)

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, id))
    .returning(userSelectFields);

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/admin/users/[id]
// =============================================================

export async function DELETE(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!existing) return ApiResponse.notFound('Utente non trovato');

  // Soft delete: non cancellare fisicamente per mantenere lo storico turni/richieste
  const [updated] = await db
    .update(users)
    .set({ active: false })
    .where(eq(users.id, id))
    .returning(userSelectFields);

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'user.deactivate',
    entityType: 'user',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok({ deactivated: true });
}
