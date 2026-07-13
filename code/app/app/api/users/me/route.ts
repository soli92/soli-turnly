/**
 * app/api/users/me/route.ts — Profilo utente corrente (TSK-004).
 *
 * GET   /api/users/me  — Restituisce il profilo dell'utente autenticato.
 * PATCH /api/users/me  — Aggiorna solo i campi consentiti (RB-13, T-SEC-04).
 *
 * Campi modificabili dal dipendente: firstName, lastName.
 * Campi vietati (qualificationId, role, contractHours, active, email, passwordHash):
 * se presenti nel body → 403 (T-SEC-04).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { userPatchSchema } from '@/lib/zod';

// Campi che il dipendente NON può modificare (RB-13, T-SEC-04)
const FORBIDDEN_SELF_PATCH_FIELDS = [
  'qualificationId',
  'role',
  'contractHours',
  'active',
  'email',
  'passwordHash',
] as const;

// =============================================================
// GET /api/users/me
// =============================================================

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      qualificationId: users.qualificationId,
      contractHours: users.contractHours,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.user.id as string))
    .limit(1);

  if (!user) return ApiResponse.notFound('Utente non trovato');

  return ApiResponse.ok(user);
}

// =============================================================
// PATCH /api/users/me
// =============================================================

export async function PATCH(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  // Verifica preventiva campi vietati (RB-13, T-SEC-04)
  // Se il body contiene qualsiasi campo non consentito → 403
  if (body !== null && typeof body === 'object') {
    const bodyKeys = Object.keys(body as Record<string, unknown>);
    const hasForbidden = FORBIDDEN_SELF_PATCH_FIELDS.some((f) =>
      bodyKeys.includes(f),
    );
    if (hasForbidden) return ApiResponse.forbidden();
  }

  const parsed = userPatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  // Nessun campo da aggiornare
  if (Object.keys(parsed.data).length === 0) {
    return ApiResponse.badRequest('Nessun campo modificabile fornito');
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id as string))
    .limit(1);

  if (!existing) return ApiResponse.notFound('Utente non trovato');

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(eq(users.id, session.user.id as string))
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      qualificationId: users.qualificationId,
      contractHours: users.contractHours,
      active: users.active,
      createdAt: users.createdAt,
    });

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'user.update',
    entityType: 'user',
    entityId: session.user.id as string,
    before: { firstName: existing.firstName, lastName: existing.lastName },
    after: parsed.data,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}
