/**
 * app/api/admin/swap/route.ts — Scambio diretto turni (admin) (TSK-004).
 *
 * POST /api/admin/swap
 *   - Admin only.
 *   - Scambia due turni tra dipendenti direttamente.
 *   - Stub: TSK-006 implementa la logica di scambio con validazione RB-01.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { swapCreateSchema } from '@/lib/zod';

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

  const parsed = swapCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const { shiftIdA, shiftIdB } = parsed.data;

  // Recupera entrambi i turni
  const [shiftA] = await db.select().from(shifts).where(eq(shifts.id, shiftIdA)).limit(1);
  if (!shiftA) return ApiResponse.notFound(`Turno A (${shiftIdA}) non trovato`);

  const [shiftB] = await db.select().from(shifts).where(eq(shifts.id, shiftIdB)).limit(1);
  if (!shiftB) return ApiResponse.notFound(`Turno B (${shiftIdB}) non trovato`);

  // TODO TSK-006: validate RB-01 (no sovrapposizione dopo scambio userId)
  // TODO TSK-006: validate RB-03 (riposo minimo)
  // TODO TSK-006: validate RB-07 (qualifica compatibile)
  // TODO TSK-006: eseguire lo scambio fisico — aggiornare userId su entrambi i turni

  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'swap.admin',
    entityType: 'shift',
    entityId: shiftIdA,
    before: { shiftA, shiftB },
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return Response.json(
    { error: 'not implemented', message: 'Logica swap completata in TSK-006' },
    { status: 501 },
  );
}
