/**
 * lib/sse/broker.ts — Broker SSE in-process per notifiche real-time (TSK-008).
 *
 * Mantiene una mappa userId → Set di controller attivi.
 * Quando un client SSE si connette, il suo ReadableStreamDefaultController
 * viene registrato; alla disconnessione viene rimosso (via cancel()).
 *
 * LIMITAZIONE (multi-instance): questo broker è in-memory e legato alla singola
 * istanza Node.js. In un deployment serverless (Vercel, AWS Lambda) ogni
 * request viene gestita da una istanza separata: i controller registrati in
 * un'istanza non sono visibili alle altre. Per un fan-out multi-instance è
 * necessario un layer pub-sub esterno (es. Redis pub-sub, Inngest, Upstash).
 * In produzione con istanza singola (Railway, Fly.io, Docker) questo broker
 * funziona correttamente.
 */

// Mappa userId → Set di controller SSE attivi (una entry per tab/client)
const clients = new Map<string, Set<ReadableStreamDefaultController>>();

export const broker = {
  /**
   * Registra un nuovo client SSE per un userId.
   * Chiamato nel `start` del ReadableStream.
   */
  addClient(userId: string, ctrl: ReadableStreamDefaultController): void {
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ctrl);
  },

  /**
   * Rimuove un client SSE per un userId.
   * Chiamato nel `cancel` del ReadableStream (disconnessione client).
   */
  removeClient(userId: string, ctrl: ReadableStreamDefaultController): void {
    const set = clients.get(userId);
    if (!set) return;
    set.delete(ctrl);
    // Pulizia entry vuote per evitare memory leak sulla mappa
    if (set.size === 0) {
      clients.delete(userId);
    }
  },

  /**
   * Invia un evento SSE a tutti i controller attivi di un userId.
   * Gestisce silenziosamente la disconnessione (try/catch su enqueue).
   *
   * Formato SSE: `data: <JSON>\n\n`
   */
  emit(userId: string, event: { type: string; payload: unknown; timestamp: string }): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    clients.get(userId)?.forEach((ctrl) => {
      try {
        ctrl.enqueue(payload);
      } catch {
        // Client disconnesso — il removeClient verrà chiamato via cancel()
      }
    });
  },

  /**
   * Restituisce il numero di client connessi per un userId.
   * Utile per test e diagnostica.
   */
  clientCount(userId: string): number {
    return clients.get(userId)?.size ?? 0;
  },
};
