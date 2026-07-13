/**
 * app/api/requests/[id]/accept-swap/route.ts — Accetta scambio turno (TSK-004).
 *
 * POST /api/requests/[id]/accept-swap
 *   - Solo il collega destinatario dello scambio (T-SEC-05).
 *   - Verifica che l'utente corrente sia il target dello swap (TSK-006).
 *   - Imposta status → 'approved' e applica lo scambio (TSK-006).
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { acceptSwapSchema } from '@/lib/zod';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  // Solo richieste di tipo shift_swap
  if (existing.type !== 'shift_swap') {
    return ApiResponse.badRequest('La richiesta non è uno scambio turno');
  }

  // TODO TSK-006: verify T-SEC-05 — solo il collega destinatario può accettare.
  //   Il payload della richiesta (existing.payload) deve contenere il targetUserId.
  //   Verifica: (existing.payload as { targetUserId?: string }).targetUserId === session.user.id
  //   Se non corrisponde → 403.

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = acceptSwapSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  // TODO TSK-006: validate RB-01 (no sovrapposizione dopo scambio)
  // TODO TSK-006: eseguire lo scambio fisico dei turni nel DB

  const [updated] = await db
    .update(requests)
    .set({
      status: 'awaiting_colleague',
      resolvedNotes: parsed.data.notes ?? null,
    })
    .where(eq(requests.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.accept_swap',
    entityType: 'request',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}
