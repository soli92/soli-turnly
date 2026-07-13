/**
 * lib/audit.ts — Audit log helper (TSK-004).
 *
 * Ogni scrittura significativa (turni, richieste, utenti, assenze) deve
 * chiamare `insertAuditLog` per garantire la tracciabilità degli accessi
 * come richiesto dall'ADR (sicurezza + conformità GDPR).
 *
 * La tabella `audit_logs` è definita in db/schema.ts (TSK-002).
 */

import { db } from '@/db';
import { auditLogs } from '@/db/schema';

// =============================================================
// Tipi
// =============================================================

/**
 * Azioni tracciate nel sistema.
 * Estendere questa union type quando si aggiungono nuove entità.
 */
export type AuditAction =
  | 'shift.create'
  | 'shift.update'
  | 'shift.delete'
  | 'shift_type.create'
  | 'shift_type.update'
  | 'shift_type.delete'
  | 'request.create'
  | 'request.submit'
  | 'request.approve'
  | 'request.reject'
  | 'request.cancel'
  | 'request.accept_swap'
  | 'user.create'
  | 'user.update'
  | 'user.password_change'
  | 'user.deactivate'
  | 'absence.create'
  | 'absence.update'
  | 'absence.delete'
  | 'swap.propose'
  | 'swap.accept'
  | 'swap.admin'
  | 'coverage.create'
  | 'notification.read';

export interface AuditLogEntry {
  /** ID dell'utente che ha eseguito l'azione (actorId). */
  actorId: string;
  /** Azione eseguita. */
  action: AuditAction;
  /** Tipo di entità (es. 'shift', 'request', 'user'). */
  entityType: string;
  /** ID dell'entità coinvolta. */
  entityId: string;
  /** Stato precedente dell'entità (serializzabile). */
  before?: unknown;
  /** Stato successivo dell'entità (serializzabile). */
  after?: unknown;
  /** IP del client (estratto dalla Request nell'handler). */
  ip?: string;
  /** User-Agent del client. */
  userAgent?: string;
}

// =============================================================
// insertAuditLog
// =============================================================

/**
 * Inserisce una riga in `audit_logs`.
 *
 * Questa funzione è fire-and-forget sicuro: in produzione non deve
 * bloccare la risposta HTTP. In caso di errore DB, l'errore viene
 * loggato ma NON propagato per evitare di fallire la richiesta
 * principale a causa di un problema di audit.
 *
 * @example
 * await insertAuditLog({
 *   actorId: session.user.id,
 *   action: 'shift.create',
 *   entityType: 'shift',
 *   entityId: newShift.id,
 *   after: newShift,
 *   ip: req.headers.get('x-forwarded-for') ?? undefined,
 * });
 */
export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    // Non blocca la risposta principale — solo log (T-OPS-01)
    console.error('[audit] insertAuditLog failed:', err);
  }
}

// =============================================================
// Helpers per estrarre metadati dalla Request
// =============================================================

/**
 * Estrae l'IP del client dalla Request.
 * Legge x-forwarded-for (proxy/CDN) con fallback a x-real-ip.
 */
export function extractIp(req: Request): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined
  );
}

/**
 * Estrae lo User-Agent dalla Request.
 */
export function extractUserAgent(req: Request): string | undefined {
  return req.headers.get('user-agent') ?? undefined;
}
