/**
 * app/api/users/me/availability/route.ts — Disponibilità dichiarata dal dipendente (TSK-025).
 *
 * GET    /api/users/me/availability       — Lista disponibilità dell'utente autenticato
 * POST   /api/users/me/availability       — Crea voce di disponibilità
 * DELETE /api/users/me/availability?id=   — Elimina voce per id (verifica ownership RB-13)
 *
 * Sicurezza:
 *   - L'userId è sempre derivato da session.user.id (RB-13, T-SEC-05)
 *   - DELETE verifica WHERE id = ? AND userId = session.user.id prima di eliminare
 *   - Un dipendente non può leggere/modificare disponibilità altrui → 403
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { availability } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { availabilityCreateSchema } from '@/lib/zod';

// =============================================================
// GET /api/users/me/availability
// =============================================================

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const userId = session.user.id as string;

  const rows = await db
    .select()
    .from(availability)
    .where(eq(availability.userId, userId))
    .orderBy(desc(availability.createdAt));

  return ApiResponse.ok(rows);
}

// =============================================================
// POST /api/users/me/availability
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const userId = session.user.id as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = availabilityCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { type, scope, definition, notes } = parsed.data;

  const [newRow] = await db
    .insert(availability)
    .values({
      userId,
      type,
      scope,
      definition: definition as Record<string, unknown>,
      notes: notes ?? null,
    })
    .returning();

  return ApiResponse.created(newRow);
}

// =============================================================
// DELETE /api/users/me/availability?id=<uuid>
// =============================================================

export async function DELETE(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const userId = session.user.id as string;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return ApiResponse.badRequest('Parametro id obbligatorio');
  }

  // Verifica ownership: la riga deve esistere E appartenere all'utente (RB-13, T-SEC-05)
  const [existing] = await db
    .select({ id: availability.id, userId: availability.userId })
    .from(availability)
    .where(eq(availability.id, id))
    .limit(1);

  if (!existing) {
    return ApiResponse.notFound('Voce di disponibilità non trovata');
  }

  if (existing.userId !== userId) {
    // Un dipendente non può eliminare disponibilità altrui
    return ApiResponse.forbidden();
  }

  await db
    .delete(availability)
    .where(and(eq(availability.id, id), eq(availability.userId, userId)));

  return ApiResponse.ok({ deleted: true });
}
