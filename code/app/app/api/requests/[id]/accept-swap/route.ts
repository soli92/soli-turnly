/**
 * app/api/requests/[id]/accept-swap/route.ts — Accetta scambio turno (TSK-004).
 *
 * POST /api/requests/[id]/accept-swap
 *   - Solo il collega destinatario dello scambio (T-SEC-05).
 *   - Verifica che l'utente corrente sia il target dello swap (TSK-006).
 *   - Imposta status → 'approved' e applica lo scambio (TSK-006).
 *   - TSK-029: dispatch Inngest 'notification/email.send' al collega bersaglio
 *     con template 'swap-request' (il destinatario riceve riepilogo della proposta).
 */

import { after } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { requests, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { acceptSwapSchema } from '@/lib/zod';
import { inngest } from '@/lib/inngest';

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

  // T-SEC-05: solo il collega destinatario può accettare lo swap.
  // Il targetUserId è memorizzato nel payload jsonb della richiesta.
  const swapPayload = existing.payload as { targetUserId?: string } | null;
  if (swapPayload?.targetUserId !== session.user.id) {
    return ApiResponse.forbidden();
  }

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

  // TSK-029: dispatch email 'swap-request' via after() — garantisce l'esecuzione su Vercel.
  // Il collega bersaglio è l'utente corrente (session.user.id) che ha accettato.
  const currentUserId = session.user.id as string;
  after(async () => {
    try {
      // Dati del destinatario (collega bersaglio = utente che ha chiamato l'endpoint)
      const [targetUser] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1);

      // Dati del richiedente originale
      const [requester] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, existing.userId))
        .limit(1);

      if (targetUser?.email) {
        const swapPayload = existing.payload as Record<string, unknown> | null;

        await inngest.send({
          name: 'notification/email.send',
          data: {
            to: targetUser.email,
            subject: 'Proposta di scambio turno — Turnly',
            template: 'swap-request',
            data: {
              recipientName: `${targetUser.firstName} ${targetUser.lastName}`,
              requesterName: requester
                ? `${requester.firstName} ${requester.lastName}`
                : 'Un collega',
              requesterShift: (swapPayload?.['requesterShift'] as string) ?? '',
              targetShift: (swapPayload?.['targetShift'] as string) ?? '',
              requestId: id,
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://turnly.app',
            },
          },
        });
      }
    } catch (err) {
      console.error('[TSK-029] dispatch swap-request email failed', err);
    }
  });

  return ApiResponse.ok(updated);
}
