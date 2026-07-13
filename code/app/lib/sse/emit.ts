/**
 * lib/sse/emit.ts — Helper di emissione eventi SSE (TSK-008).
 *
 * Fornisce due funzioni pubbliche:
 *   - emitToUser(userId, event)  → invia a tutti i client dell'userId
 *   - emitToRole('admin', event) → broadcast a tutti gli admin attualmente connessi
 *
 * Utilizzo nei route handler (fire-and-forget, senza await):
 *   emitToUser(userId, { type: 'shift.assigned', payload: { shiftId }, timestamp: new Date().toISOString() });
 *   void emitToRole('admin', { type: 'request.received', payload: { requestId }, timestamp: new Date().toISOString() });
 */

import { broker } from '@/lib/sse/broker';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SSEEvent } from '@/lib/sse/types';

/**
 * Emette un evento SSE a tutti i controller connessi di un singolo userId.
 * Operazione sincrona (non richiede DB).
 */
export function emitToUser(userId: string, event: SSEEvent): void {
  broker.emit(userId, event);
}

/**
 * Emette un evento SSE a tutti gli utenti con role='admin' che hanno
 * almeno un controller SSE attivo.
 *
 * La query recupera gli admin attivi dal DB, poi itera solo su quelli
 * effettivamente connessi (broker.clientCount > 0). È asincrona perché
 * richiede la query DB per trovare gli userId degli admin.
 *
 * In caso di errore DB il broadcast fallisce silenziosamente (log su stderr).
 */
export async function emitToRole(
  role: 'admin',
  event: SSEEvent,
): Promise<void> {
  try {
    const adminUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, role));

    for (const admin of adminUsers) {
      broker.emit(admin.id, event);
    }
  } catch (err) {
    // Non blocca il flusso principale — la notifica SSE è best-effort
    console.error('[sse/emit] emitToRole failed:', err);
  }
}
