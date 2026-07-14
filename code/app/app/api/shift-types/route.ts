/**
 * app/api/shift-types/route.ts — GET lista tipi turno, POST crea (admin) (TSK-004).
 *
 * GET  /api/shift-types — Tutti gli utenti autenticati (read-only).
 * POST /api/shift-types — Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shiftTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { shiftTypeCreateSchema } from '@/lib/zod';

// =============================================================
// GET /api/shift-types
// =============================================================

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const rows = await db.select().from(shiftTypes).where(eq(shiftTypes.active, true));

  return ApiResponse.ok(rows);
}

// =============================================================
// POST /api/shift-types
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = shiftTypeCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const [newShiftType] = await db.insert(shiftTypes).values(parsed.data).returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift_type.create',
    entityType: 'shift_type',
    entityId: newShiftType!.id,
    after: newShiftType,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.created(newShiftType);
}
