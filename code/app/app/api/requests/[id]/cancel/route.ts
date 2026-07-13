/**
 * app/api/requests/[id]/cancel/route.ts — Annulla richiesta (TSK-004).
 *
 * POST /api/requests/[id]/cancel
 *   - Solo il proprietario della richiesta.
 *   - Imposta status → 'cancelled'.
 *   - Stub: TSK-006 validerà se la richiesta può essere annullata in base allo stato.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { requests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const { id } = await params;

  const [existing] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!existing) return ApiResponse.notFound('Richiesta non trovata');

  // Solo il proprietario può annullare
  if (existing.userId !== session.user.id && session.user.role !== 'admin') {
    return ApiResponse.forbidden();
  }

  // TODO TSK-006: validate RB-16 — annullamento consentito solo se status in ['draft', 'sent']
  // TODO TSK-006: se status = 'approved' → solo admin può annullare con motivo

  const [updated] = await db
    .update(requests)
    .set({
      status: 'cancelled',
      resolvedBy: session.user.id as string,
      resolvedAt: new Date(),
    })
    .where(eq(requests.id, id))
    .returning();

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'request.cancel',
    entityType: 'request',
    entityId: id,
    before: existing,
    after: updated,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.ok(updated);
}
