/**
 * app/api/requests/route.ts — GET lista richieste, POST crea richiesta (TSK-004).
 *
 * GET  /api/requests
 *   - Dipendente: solo le proprie richieste.
 *   - Admin: tutte le richieste; supporta filtro ?userId=, ?status=, ?type=.
 *   Query params: userId, status, type, page (default 1), limit (default 20).
 *
 * POST /api/requests
 *   - Qualsiasi utente autenticato.
 *   - Valida con requestCreateSchema; stub regole RB (TSK-006).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { and, eq, type SQL } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { requestCreateSchema } from '@/lib/zod';
import { emitToRole } from '@/lib/sse/emit';

// =============================================================
// GET /api/requests
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const isAdmin = session.user.role === 'admin';

  // Paginazione
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // Costruzione filtri
  const conditions: SQL[] = [];

  // Dipendente vede solo le proprie; admin può filtrare per userId
  const userIdParam = url.searchParams.get('userId');
  if (!isAdmin) {
    conditions.push(eq(requests.userId, session.user.id as string));
  } else if (userIdParam) {
    conditions.push(eq(requests.userId, userIdParam));
  }

  // Filtro status
  const statusParam = url.searchParams.get('status');
  if (statusParam) {
    // Validazione minima — i valori invalidi restituiranno array vuoto
    conditions.push(eq(requests.status, statusParam as 'draft'));
  }

  // Filtro type
  const typeParam = url.searchParams.get('type');
  if (typeParam) {
    conditions.push(eq(requests.type, typeParam as 'absence'));
  }

  const rows = await db
    .select()
    .from(requests)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// =============================================================
// POST /api/requests
// =============================================================

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = requestCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { type, payload } = parsed.data;

  // TODO TSK-006: validate RB-14 (no richieste duplicate in pending)
  // TODO TSK-006: validate RB-15 (finestra temporale per tipo richiesta)
  // TODO TSK-006: validate RB-16 (limiti di ferie annuali)

  const [newRequest] = await db
    .insert(requests)
    .values({
      userId: session.user.id as string,
      type,
      status: 'draft',
      payload: (payload ?? null) as Record<string, unknown> | null,
      submittedAt: new Date(),
    })
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.create',
    entityType: 'request',
    entityId: newRequest!.id,
    after: newRequest,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  // SSE TSK-008: broadcast agli admin — nuova richiesta da approvare (fire-and-forget)
  void emitToRole('admin', {
    type: 'request.received',
    payload: { requestId: newRequest!.id, type, userId: session.user.id },
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.created(newRequest);
}
