/**
 * lib/api-response.ts — Pattern risposta standard per Route Handlers (TSK-004).
 *
 * Centralizza la costruzione di tutte le risposte HTTP API per garantire
 * coerenza di formato e status code in tutto il backend.
 *
 * Utilizzo:
 *   import { ApiResponse } from '@/lib/api-response';
 *
 *   return ApiResponse.ok(data);
 *   return ApiResponse.unauthorized();
 *   return ApiResponse.badRequest(parsed.error.issues);
 */

export const ApiResponse = {
  /** 200 OK — risposta standard con dati. */
  ok: (data: unknown, status = 200) => Response.json(data, { status }),

  /** 201 Created — risorsa creata con successo. */
  created: (data: unknown) => Response.json(data, { status: 201 }),

  /** 401 Unauthorized — sessione mancante o scaduta. */
  unauthorized: () =>
    Response.json({ error: 'unauthorized' }, { status: 401 }),

  /** 403 Forbidden — autenticato ma senza permesso. */
  forbidden: () => Response.json({ error: 'forbidden' }, { status: 403 }),

  /**
   * 400 Bad Request — body non valido (Zod issues).
   * @param issues Array di ZodIssue o messaggio stringa.
   */
  badRequest: (issues: unknown) =>
    Response.json({ error: 'validation', issues }, { status: 400 }),

  /**
   * 404 Not Found.
   * @param msg Messaggio opzionale.
   */
  notFound: (msg = 'not found') =>
    Response.json({ error: msg }, { status: 404 }),

  /**
   * 409 Conflict — risorsa già esistente o stato non compatibile.
   */
  conflict: (msg = 'conflict') =>
    Response.json({ error: msg }, { status: 409 }),

  /**
   * 500 Internal Server Error — errore imprevisto del server.
   */
  serverError: (msg = 'internal server error') =>
    Response.json({ error: msg }, { status: 500 }),
};
