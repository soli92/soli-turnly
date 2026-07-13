/**
 * app/api/admin/absences/route.ts — Gestione assenze (admin) (TSK-004).
 *
 * GET  /api/admin/absences — Lista tutte le assenze (con filtri).
 * POST /api/admin/absences — Crea assenza.
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { absences } from '@/db/schema';
import { and, eq, type SQL } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { absenceCreateSchema } from '@/lib/zod';

// =============================================================
// GET /api/admin/absences
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  const userIdParam = url.searchParams.get('userId');
  if (userIdParam) conditions.push(eq(absences.userId, userIdParam));

  const statusParam = url.searchParams.get('status');
  if (statusParam) conditions.push(eq(absences.status, statusParam as 'pending'));

  const rows = await db
    .select()
    .from(absences)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// =============================================================
// POST /api/admin/absences
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

  const parsed = absenceCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  // TODO TSK-006: validate RB-09 (overlap assenze)
  // TODO TSK-006: validate RB-10 (saldo ferie disponibile)

  const [newAbsence] = await db
    .insert(absences)
    .values({
      userId: parsed.data.userId,
      absenceTypeId: parsed.data.absenceTypeId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      notes: parsed.data.notes ?? null,
      status: 'approved', // Inserimento diretto admin → già approvata
      approvedBy: session.user.id as string,
      approvedAt: new Date(),
    })
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'absence.create',
    entityType: 'absence',
    entityId: newAbsence!.id,
    after: newAbsence,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.created(newAbsence);
}
