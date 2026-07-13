/**
 * lib/sse/types.ts — Tipi per gli eventi SSE notifiche real-time (TSK-008).
 *
 * SSEEventType copre tutti gli eventi notifica definiti nell'architettura:
 *   - eventi turno (shift.*) → destinatario: dipendente
 *   - eventi richiesta (request.*) → destinatario: dipendente o admin
 *   - eventi scambio (swap.*) → destinatario: dipendente
 */

export type SSEEventType =
  | 'shift.assigned'
  | 'shift.modified'
  | 'shift.deleted'
  | 'request.received'
  | 'request.approved'
  | 'request.rejected'
  | 'swap.request'
  | 'swap.accepted';

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  payload: T;
  /** Timestamp ISO 8601 — aggiunto automaticamente da emitToUser/emitToRole. */
  timestamp: string;
}
