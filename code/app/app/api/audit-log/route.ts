/**
 * app/api/audit-log/route.ts — Lettura audit log (TSK-009).
 *
 * GET /api/audit-log
 *
 * Admin only (T-SEC-05).
 *
 * Query params:
 *   page        (default: 1)     — paginazione offset/limit
 *   limit       (default: 100, max: 500)
 *   entityType  (opzionale)      — filtra per tipo entità (shift, request, user, …)
 *   actorId     (opzionale)      — filtra per UUID attore
 *   action      (opzionale)      — filtra per azione (es. 'shift.create')
 *   from        (opzionale)      — ISO 8601 datetime — createdAt >= from
 *   to          (opzionale)      — ISO 8601 datetime — createdAt <= to
 *
 * Risposta:
 *   { data: AuditLog[], page: number, limit: number, total: number }
 *
 * Ordinamento: createdAt DESC (le voci più recenti prima).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { and, eq, gte, lte, desc, count } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';

export async function GET(req: Request): Promise<Response> {
  // ------------------------------------------------------------------
  // Autenticazione e autorizzazione (admin only — T-SEC-05)
  // ------------------------------------------------------------------
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  // ------------------------------------------------------------------
  // Parsing query params
  // ------------------------------------------------------------------
  const url = new URL(req.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '100', 10)),
  );
  const offset = (page - 1) * limit;

  const entityType = url.searchParams.get('entityType') ?? undefined;
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const fromParam = url.searchParams.get('from') ?? undefined;
  const toParam = url.searchParams.get('to') ?? undefined;

  // Validazione UUID actorId (se fornito)
  if (actorId !== undefined) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(actorId)) {
      return ApiResponse.badRequest('actorId deve essere un UUID valido');
    }
  }

  // Parsing date range
  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (fromParam) {
    fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      return ApiResponse.badRequest('from: formato datetime non valido');
    }
  }
  if (toParam) {
    toDate = new Date(toParam);
    if (isNaN(toDate.getTime())) {
      return ApiResponse.badRequest('to: formato datetime non valido');
    }
  }

  // ------------------------------------------------------------------
  // Costruzione filtri WHERE (condizioni opzionali)
  // ------------------------------------------------------------------
  const conditions = [
    entityType ? eq(auditLogs.entityType, entityType) : undefined,
    actorId ? eq(auditLogs.actorId, actorId) : undefined,
    action ? eq(auditLogs.action, action) : undefined,
    fromDate ? gte(auditLogs.createdAt, fromDate) : undefined,
    toDate ? lte(auditLogs.createdAt, toDate) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // ------------------------------------------------------------------
  // Query: dati + count totale (per la paginazione)
  // ------------------------------------------------------------------
  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause),
  ]);

  return ApiResponse.ok({
    data: rows,
    page,
    limit,
    total: Number(total),
  });
}
