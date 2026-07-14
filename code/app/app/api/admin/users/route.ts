/**
 * app/api/admin/users/route.ts — Gestione utenti (admin) (TSK-004).
 *
 * GET  /api/admin/users — Lista utenti.
 * POST /api/admin/users — Crea utente.
 *
 * Admin only.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { adminUserCreateSchema } from '@/lib/zod';

// =============================================================
// GET /api/admin/users
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const url = new URL(req.url);

  // Paginazione
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // Filtro active
  const activeParam = url.searchParams.get('active');

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      qualificationId: users.qualificationId,
      contractHours: users.contractHours,
      phone: users.phone,
      contractType: users.contractType,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(activeParam !== null ? eq(users.active, activeParam === 'true') : undefined)
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// =============================================================
// POST /api/admin/users
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

  const parsed = adminUserCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { password, ...rest } = parsed.data;

  // TODO TSK-006: validate RB-13 (unicità email)
  const passwordHash = await bcrypt.hash(password, 12);

  const [newUser] = await db
    .insert(users)
    .values({ ...rest, passwordHash })
    .returning({
      id: users.id,
      email: users.email,
      role: users.role,
      firstName: users.firstName,
      lastName: users.lastName,
      qualificationId: users.qualificationId,
      contractHours: users.contractHours,
      phone: users.phone,
      contractType: users.contractType,
      active: users.active,
      createdAt: users.createdAt,
    });

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'user.create',
    entityType: 'user',
    entityId: newUser!.id,
    after: newUser,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.created(newUser);
}
