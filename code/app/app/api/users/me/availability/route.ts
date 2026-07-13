/**
 * app/api/users/me/availability/route.ts — Disponibilità utente (TSK-004).
 *
 * GET    /api/users/me/availability  — Lista disponibilità dichiarate.
 * POST   /api/users/me/availability  — Crea disponibilità.
 * DELETE /api/users/me/availability  — Elimina disponibilità per periodo.
 *
 * TODO TSK-006: implementazione completa con tabella recurrences/availability.
 *   Per ora stub che restituisce 501 Not Implemented.
 */

import { auth } from '@/auth';
import { ApiResponse } from '@/lib/api-response';

// =============================================================
// GET /api/users/me/availability
// =============================================================

export async function GET(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // TODO TSK-006: query tabella recurrences per disponibilità dipendente
  return Response.json(
    { error: 'not implemented', message: 'Disponibilità implementata in TSK-006' },
    { status: 501 },
  );
}

// =============================================================
// POST /api/users/me/availability
// =============================================================

export async function POST(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // TODO TSK-006: crea regola di disponibilità per il dipendente
  return Response.json(
    { error: 'not implemented', message: 'Disponibilità implementata in TSK-006' },
    { status: 501 },
  );
}

// =============================================================
// DELETE /api/users/me/availability
// =============================================================

export async function DELETE(_req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  // TODO TSK-006: elimina disponibilità per periodo
  return Response.json(
    { error: 'not implemented', message: 'Disponibilità implementata in TSK-006' },
    { status: 501 },
  );
}
