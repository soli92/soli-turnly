/**
 * app/api/notifications/sse/route.ts — SSE stream notifiche real-time (TSK-008).
 *
 * GET /api/notifications/sse
 *   - Risponde con content-type text/event-stream.
 *   - Registra il client nel broker in-process; rimuove alla disconnessione.
 *   - Heartbeat ogni 30s per prevenire timeout dei proxy intermediari.
 *   - 401 se la sessione non è presente (T-SEC-03).
 *
 * Formato eventi SSE:
 *   data: {"type":"shift.assigned","payload":{...},"timestamp":"..."}\n\n
 *
 * Nota: il broker è in-memory, quindi funziona solo su istanza singola.
 * Per deployment multi-instance (Vercel) è necessario Redis pub-sub o Inngest.
 * Vedi lib/sse/broker.ts per i dettagli.
 */

import { auth } from '@/auth';
import { broker } from '@/lib/sse/broker';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const userId = session.user.id as string;

  // Il controller viene inizializzato nel callback `start`; la variabile
  // è accessibile nel callback `cancel` tramite closure.
  let controller: ReadableStreamDefaultController;
  let heartbeatTimer: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      broker.addClient(userId, controller);

      // Evento di connessione iniziale (informativo, non trigger di azioni FE)
      try {
        controller.enqueue(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);
      } catch {
        // ignore
      }

      // Heartbeat ogni 30s per tenere la connessione viva attraverso proxy/CDN
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(': heartbeat\n\n');
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 30_000);
    },
    cancel() {
      clearInterval(heartbeatTimer);
      broker.removeClient(userId, controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
