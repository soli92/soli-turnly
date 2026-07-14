/**
 * RB-13 — Campi contrattuali riservati agli admin.
 * Severity: BLOCKING
 *
 * Un dipendente (role !== 'admin') non può modificare i campi riservati:
 * qualificationId, contractHours, role.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 */
import type { ValidationResult } from './types';
import { emptyResult } from './types';

/** Campi del profilo utente che solo un admin può modificare. */
const ADMIN_ONLY_FIELDS: readonly string[] = ['qualificationId', 'contractHours', 'role'];

/**
 * Verifica che un utente non-admin non tenti di modificare campi riservati.
 *
 * @param patchFields - Chiavi del payload PATCH (es. Object.keys(req.body)).
 * @param userRole    - Ruolo dell'utente che effettua la richiesta.
 */
export function validateContractFields(patchFields: string[], userRole: string): ValidationResult {
  const result = emptyResult();

  if (userRole === 'admin') {
    return result;
  }

  for (const field of patchFields) {
    if (ADMIN_ONLY_FIELDS.includes(field)) {
      result.valid = false;
      result.blocking.push({
        ruleId: 'RB-13',
        severity: 'blocking',
        message: `Il campo "${field}" è riservato agli amministratori e non può essere modificato`,
        field,
      });
    }
  }

  return result;
}
