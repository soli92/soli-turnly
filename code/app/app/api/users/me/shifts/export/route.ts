/**
 * app/api/users/me/shifts/export/route.ts — Export turni dipendente in formato .ics
 *
 * GET /api/users/me/shifts/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Sicurezza (T-SEC-01/02):
 *   - Solo utente autenticato
 *   - Filtra SEMPRE per userId = session.user.id — nessun IDOR
 *   - Nessun param userId esposto (l'ID viene dal token, non dai query params)
 *
 * Output: text/calendar (RFC 5545 iCalendar)
 * Package: ics
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { shifts, shiftTypes } from '@/db/schema';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import { ApiResponse } from '@/lib/api-response';
import { createEvents, type EventAttributes, type EventStatus } from 'ics';

// =============================================================
// GET /api/users/me/shifts/export
// =============================================================

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to'); // YYYY-MM-DD

  // Costruzione condizioni — userId sempre dal token (T-SEC-01)
  const conditions: SQL[] = [eq(shifts.userId, session.user.id as string)];
  if (from) conditions.push(gte(shifts.date, from));
  if (to) conditions.push(lte(shifts.date, to));

  // Join con shiftTypes per avere il nome del turno nel .ics
  const rows = await db
    .select({
      id: shifts.id,
      startDt: shifts.startDt,
      endDt: shifts.endDt,
      notes: shifts.notes,
      status: shifts.status,
      shiftTypeName: shiftTypes.name,
    })
    .from(shifts)
    .leftJoin(shiftTypes, eq(shifts.shiftTypeId, shiftTypes.id))
    .where(and(...conditions))
    .limit(500);

  // Mappa Drizzle row → EventAttributes per ics
  const events: EventAttributes[] = rows.map((shift) => {
    const start = new Date(shift.startDt);
    const end = new Date(shift.endDt);

    const icsStatus: EventStatus =
      shift.status === 'cancelled'
        ? 'CANCELLED'
        : shift.status === 'confirmed'
          ? 'CONFIRMED'
          : 'TENTATIVE';

    const event: EventAttributes = {
      uid: shift.id,
      title: shift.shiftTypeName ?? 'Turno',
      startInputType: 'utc',
      endInputType: 'utc',
      start: [
        start.getUTCFullYear(),
        start.getUTCMonth() + 1,
        start.getUTCDate(),
        start.getUTCHours(),
        start.getUTCMinutes(),
      ],
      end: [
        end.getUTCFullYear(),
        end.getUTCMonth() + 1,
        end.getUTCDate(),
        end.getUTCHours(),
        end.getUTCMinutes(),
      ],
      status: icsStatus,
    };

    // Aggiunge description solo se le note sono presenti (exactOptionalPropertyTypes)
    if (shift.notes) {
      event.description = shift.notes;
    }

    return event;
  });

  const { error, value } = createEvents(events);

  if (error || !value) {
    console.error('[shifts/export] ics generation error:', error);
    return ApiResponse.serverError('Errore nella generazione del file .ics');
  }

  const filename = from && to ? `turni_${from}_${to}.ics` : 'turni.ics';

  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
