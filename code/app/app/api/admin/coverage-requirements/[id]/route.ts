/**
 * app/api/admin/coverage-requirements/[id]/route.ts — CRUD fabbisogni copertura (TSK-018).
 *
 * PATCH  /api/admin/coverage-requirements/[id] — aggiorna regola
 * DELETE /api/admin/coverage-requirements/[id] — elimina regola (con check turni attivi)
 *
 * Admin only. RF-H, RB-07.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { coverageRequirements, shifts } from '@/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { coverageRequirementPatchSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================
// PATCH /api/admin/coverage-requirements/[id]
// =============================================================

export async function PATCH(req: Request, ctx: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await ctx.params;

  const body: unknown = await req.json().catch(() => null);
  const parsed = coverageRequirementPatchSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const existing = await db
    .select()
    .from(coverageRequirements)
    .where(eq(coverageRequirements.id, id))
    .limit(1);

  if (existing.length === 0) return ApiResponse.notFound('Regola non trovata');

  const [updated] = await db
    .update(coverageRequirements)
    .set(parsed.data)
    .where(eq(coverageRequirements.id, id))
    .returning();

  return ApiResponse.ok(updated);
}

// =============================================================
// DELETE /api/admin/coverage-requirements/[id]
// =============================================================

export async function DELETE(req: Request, ctx: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const { id } = await ctx.params;

  const existing = await db
    .select()
    .from(coverageRequirements)
    .where(eq(coverageRequirements.id, id))
    .limit(1);

  if (existing.length === 0) return ApiResponse.notFound('Regola non trovata');

  // Controlla se ci sono turni pianificati oggi che ricadono nella fascia
  // (avviso RB-07: elimina regola → dialog conferma se ci sono turni attivi)
  const todayRaw = new Date().toISOString().split('T');
  const today: string = todayRaw[0] ?? '';
  const rule = existing[0]!;

  const shiftTypeCondition = rule.shiftTypeId
    ? eq(shifts.shiftTypeId, rule.shiftTypeId)
    : isNotNull(shifts.id);

  const activeShiftsToday = await db
    .select({ id: shifts.id })
    .from(shifts)
    .where(and(eq(shifts.date, today), shiftTypeCondition, eq(shifts.status, 'planned')))
    .limit(1);

  const hasActiveShifts = activeShiftsToday.length > 0;

  // Il client ha già mostrato il dialog di conferma; il parametro ?force=1
  // permette di bypassare il check per dare la conferma definitiva.
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  if (hasActiveShifts && !force) {
    return Response.json(
      {
        error: 'active_shifts_today',
        message: "Ci sono turni pianificati oggi per questa fascia. Confermare l'eliminazione.",
        hasActiveShifts: true,
      },
      { status: 409 }
    );
  }

  await db.delete(coverageRequirements).where(eq(coverageRequirements.id, id));

  return ApiResponse.ok({ deleted: true, id });
}
