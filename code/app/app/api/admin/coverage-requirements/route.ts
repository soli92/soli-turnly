/**
 * app/api/admin/coverage-requirements/route.ts — CRUD fabbisogni copertura (TSK-018).
 *
 * GET  /api/admin/coverage-requirements — lista regole con join qualification + shiftType
 * POST /api/admin/coverage-requirements — crea nuova regola
 *
 * Admin only. RF-H, RB-07.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { coverageRequirements, qualifications, shiftTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { coverageRequirementCreateSchema } from '@/lib/zod';

// =============================================================
// GET /api/admin/coverage-requirements
// =============================================================

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const rows = await db
    .select({
      id: coverageRequirements.id,
      qualificationId: coverageRequirements.qualificationId,
      qualificationName: qualifications.name,
      qualificationColor: qualifications.color,
      shiftTypeId: coverageRequirements.shiftTypeId,
      shiftTypeName: shiftTypes.name,
      shiftTypeCode: shiftTypes.code,
      shiftTypeColor: shiftTypes.color,
      dayOfWeek: coverageRequirements.dayOfWeek,
      minimumCount: coverageRequirements.minimumCount,
      notes: coverageRequirements.notes,
      createdAt: coverageRequirements.createdAt,
    })
    .from(coverageRequirements)
    .leftJoin(qualifications, eq(coverageRequirements.qualificationId, qualifications.id))
    .leftJoin(shiftTypes, eq(coverageRequirements.shiftTypeId, shiftTypes.id))
    .orderBy(coverageRequirements.createdAt);

  return ApiResponse.ok(rows);
}

// =============================================================
// POST /api/admin/coverage-requirements
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const body: unknown = await req.json().catch(() => null);
  const parsed = coverageRequirementCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { qualificationId, shiftTypeId, dayOfWeek, minimumCount, notes } = parsed.data;

  const [row] = await db
    .insert(coverageRequirements)
    .values({
      qualificationId,
      shiftTypeId: shiftTypeId ?? null,
      dayOfWeek: dayOfWeek ?? null,
      minimumCount,
      notes: notes ?? null,
    })
    .returning();

  return ApiResponse.created(row);
}
