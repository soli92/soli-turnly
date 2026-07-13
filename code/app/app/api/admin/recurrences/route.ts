/**
 * app/api/admin/recurrences/route.ts — Gestione ricorrenze (TSK-009).
 *
 * GET  /api/admin/recurrences — lista ricorrenze
 * POST /api/admin/recurrences — crea ricorrenza + triggera Inngest
 *
 * Admin only.
 *
 * Il POST triggera immediatamente il job 'shift/recurrence.trigger' per
 * generare i turni del periodo corrente (30 giorni dall'oggi).
 * L'admin può triggerare periodi futuri inviando manualmente l'evento
 * dalla dashboard Inngest o tramite un'azione dedicata.
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { recurrences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { ApiResponse } from '@/lib/api-response';
import { insertAuditLog, extractIp, extractUserAgent } from '@/lib/audit';
import { inngest } from '@/lib/inngest';

// ---------------------------------------------------------------------------
// Schema di validazione
// ---------------------------------------------------------------------------

const recurrenceCreateSchema = z
  .object({
    userId: z.string().uuid('userId: UUID non valido'),
    shiftTypeId: z.string().uuid('shiftTypeId: UUID non valido'),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate: formato YYYY-MM-DD atteso'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate: formato YYYY-MM-DD atteso')
      .optional()
      .nullable(),
    frequency: z.enum(['weekly', 'biweekly', 'monthly']),
    daysOfWeek: z
      .array(z.number().int().min(0).max(6))
      .min(1, 'daysOfWeek deve contenere almeno un giorno'),
  })
  .refine(
    (d) => !d.endDate || d.startDate <= d.endDate,
    { message: 'endDate deve essere successiva a startDate', path: ['endDate'] },
  );

type RecurrenceCreateInput = z.infer<typeof recurrenceCreateSchema>;

// ---------------------------------------------------------------------------
// GET /api/admin/recurrences
// ---------------------------------------------------------------------------

export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  const url = new URL(req.url);

  // Paginazione
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  // Filtro: userId
  const userIdParam = url.searchParams.get('userId') ?? undefined;
  // Filtro: attive/inattive
  const activeParam = url.searchParams.get('active');

  const rows = await db
    .select()
    .from(recurrences)
    .where(
      (() => {
        const filters = [];
        if (userIdParam) filters.push(eq(recurrences.userId, userIdParam));
        if (activeParam !== null) {
          filters.push(eq(recurrences.active, activeParam === 'true'));
        }
        if (filters.length === 0) return undefined;
        return and(...(filters as Parameters<typeof and>));
      })(),
    )
    .limit(limit)
    .offset(offset);

  return ApiResponse.ok({ data: rows, page, limit });
}

// ---------------------------------------------------------------------------
// POST /api/admin/recurrences
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session) return ApiResponse.unauthorized();
  if (session.user.role !== 'admin') return ApiResponse.forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiResponse.badRequest('Body JSON non valido');
  }

  const parsed = recurrenceCreateSchema.safeParse(body);
  if (!parsed.success) return ApiResponse.badRequest(parsed.error.issues);

  const input: RecurrenceCreateInput = parsed.data;

  // Crea la ricorrenza nel DB
  const [newRecurrence] = await db
    .insert(recurrences)
    .values({
      userId: input.userId,
      shiftTypeId: input.shiftTypeId,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      frequency: input.frequency,
      daysOfWeek: input.daysOfWeek,
      active: true,
      createdBy: session.user.id as string,
    })
    .returning();

  if (!newRecurrence) {
    return ApiResponse.serverError('Errore nella creazione della ricorrenza');
  }

  // Triggera il job Inngest per generare i turni dei prossimi 30 giorni
  const today = new Date();
  const in30days = new Date();
  in30days.setDate(today.getDate() + 30);

  const periodStart = today.toISOString().slice(0, 10);
  const periodEnd = in30days.toISOString().slice(0, 10);

  await inngest.send({
    name: 'shift/recurrence.trigger',
    data: {
      recurrenceId: newRecurrence.id,
      periodStart,
      periodEnd,
    },
  });

  // Audit log
  await insertAuditLog({
    actorId: session.user.id as string,
    action: 'shift.create',
    entityType: 'recurrence',
    entityId: newRecurrence.id,
    after: newRecurrence,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
  });

  return ApiResponse.created({
    ...newRecurrence,
    _job: { triggered: true, periodStart, periodEnd },
  });
}
