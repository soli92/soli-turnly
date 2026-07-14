/**
 * app/api/shifts/route.ts — GET lista turni, POST crea turno (TSK-004).
 *
 * GET  /api/shifts
 *   - Dipendente: restituisce solo i propri turni (T-SEC-01).
 *   - Admin: restituisce tutti i turni; supporta filtro ?userId=.
 *   Query params: userId, dateFrom, dateTo, page (default 1), limit (default 20).
 *
 * POST /api/shifts
 *   - Admin only (T-SEC-02).
 *   - Valida con shiftCreateSchema; stub regole RB (TSK-006).
 *   - TSK-029: dispatch Inngest 'notification/email.send' al dipendente assegnato (fire-and-forget).
 */

import { after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, users, shiftTypes } from '@/db/schema';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { shiftCreateSchema } from '@/lib/zod';
import { emitToUser } from '@/lib/sse/emit';
import { inngest } from '@/lib/inngest';
import { formatISODate, formatTime, APP_TIMEZONE } from '@/lib/date';

// =============================================================
// GET /api/shifts
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const isAdmin = session.user.role === 'admin';

  // Filtro userId: dipendente usa sempre il proprio id (T-SEC-01)
  const userIdParam = url.searchParams.get('userId');
  const targetUserId = isAdmin && userIdParam ? userIdParam : session.user.id;

  // Filtri data
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  // Paginazione
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // Costruzione filtri Drizzle
  const conditions: SQL[] = [];

  if (!isAdmin || userIdParam) {
    conditions.push(eq(shifts.userId, targetUserId as string));
  }

  if (dateFrom) {
    conditions.push(gte(shifts.date, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(shifts.date, dateTo));
  }

  const rows = await db
    .select()
    .from(shifts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// =============================================================
// POST /api/shifts
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // Solo admin può creare turni (T-SEC-02)
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = shiftCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { userId, shiftTypeId, date, startDt, endDt, notes, status } = parsed.data;

  // TODO TSK-006: validate RB-01 (no sovrapposizione turni — EXCLUDE USING gist)
  // TODO TSK-006: validate RB-02 (orario max giornaliero)
  // TODO TSK-006: validate RB-03 (riposo minimo tra turni)
  // TODO TSK-006: validate RB-12 (timezone Europe/Rome per date)

  const [newShift] = await db
    .insert(shifts)
    .values({
      userId,
      shiftTypeId: shiftTypeId ?? null,
      date,
      startDt: new Date(startDt),
      endDt: new Date(endDt),
      notes: notes ?? null,
      status,
      origin: 'manual',
      createdBy: session.user.id as string,
    })
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.create',
    entityType: 'shift',
    entityId: newShift!.id,
    after: newShift,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  // SSE TSK-008: notifica il dipendente assegnato al turno
  emitToUser(userId, {
    type: 'shift.assigned',
    payload: { shiftId: newShift!.id, date: newShift!.date },
    timestamp: new Date().toISOString(),
  });

  // TSK-029: dispatch email Inngest via after() — garantisce l'esecuzione su Vercel
  const createdShift = newShift!;
  after(async () => {
    try {
      // Lookup email e nome del dipendente assegnato
      const [employee] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!employee?.email) return;

      // Lookup nome tipo turno (facoltativo — può essere null)
      let shiftTypeName = '';
      if (shiftTypeId) {
        const [st] = await db
          .select({ name: shiftTypes.name })
          .from(shiftTypes)
          .where(eq(shiftTypes.id, shiftTypeId))
          .limit(1);
        shiftTypeName = st?.name ?? '';
      }

      await inngest.send({
        name: 'notification/email.send',
        data: {
          to: employee.email,
          subject: 'Nuovo turno assegnato — Turnly',
          template: 'shift-assigned',
          data: {
            recipientName: `${employee.firstName} ${employee.lastName}`,
            date: formatISODate(createdShift.date, APP_TIMEZONE, 'EEEE d MMMM yyyy'),
            startTime: formatTime(createdShift.startDt),
            endTime: formatTime(createdShift.endDt),
            shiftTypeName,
            appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://turnly.app',
          },
        },
      });
    } catch (err) {
      console.error('[TSK-029] dispatch shift-assigned email failed', err);
    }
  });

  return ApiResponse.created(newShift);
}
