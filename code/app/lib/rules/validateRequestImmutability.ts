/**
 * RB-16 — Richiesta con status approved/rejected è immutabile.
 * Severity: BLOCKING
 *
 * Una richiesta già approvata o rifiutata non può essere modificata
 * né cancellata.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import type { ValidationResult } from './types';
import { emptyResult } from './types';

/** Staus terminali che rendono una richiesta immutabile. */
const IMMUTABLE_STATUSES = ['approved', 'rejected'] as const;
type ImmutableStatus = (typeof IMMUTABLE_STATUSES)[number];

function isImmutable(status: string): status is ImmutableStatus {
  return IMMUTABLE_STATUSES.includes(status as ImmutableStatus);
}

export type MutationAction = 'update' | 'delete';

/**
 * Verifica che una richiesta con status terminale non venga modificata
 * o cancellata.
 *
 * @param requestId     - ID della richiesta da modificare.
 * @param currentStatus - Status corrente della richiesta.
 * @param action        - Tipo di mutazione tentata ('update' | 'delete').
 */
export function validateRequestImmutability(
  requestId: string,
  currentStatus: string,
  action: MutationAction,
): ValidationResult {
  const result = emptyResult();

  if (isImmutable(currentStatus)) {
    result.valid = false;
    result.blocking.push({
      ruleId: 'RB-16',
      severity: 'blocking',
      message: `La richiesta ${requestId} ha status "${currentStatus}" e non può essere ${action === 'delete' ? 'cancellata' : 'modificata'}`,
    });
  }

  return result;
}
