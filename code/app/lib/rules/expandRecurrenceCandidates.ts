/**
 * lib/rules/expandRecurrenceCandidates.ts — Espansione date wizard ricorrenza.
 *
 * Pure function — nessun side effect, nessuna chiamata DB.
 * Condivisa da POST /api/admin/recurrence/preview e /generate.
 *
 * GAP-RECURRENCE-API-001
 */

import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema payload wizard (condiviso tra preview e generate)
// ---------------------------------------------------------------------------

export const recurrenceWizardSchema = z
  .object({
    type: z.enum(['weekly', 'rotating']),
    weeklyDays: z
      .array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          shiftTypeId: z.string().uuid('shiftTypeId: UUID non valido'),
        })
      )
      .optional(),
    rotatingSequence: z.array(z.string().uuid('UUID non valido')).optional(),
    cycleLength: z.number().int().positive().optional(),
    userIds: z.array(z.string().uuid('UUID non valido')).min(1, 'Almeno un utente richiesto'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate: formato YYYY-MM-DD atteso'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate: formato YYYY-MM-DD atteso'),
    skipHolidays: z.boolean(),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: 'endDate deve essere successiva o uguale a startDate',
    path: ['endDate'],
  });

export type RecurrenceWizardInput = z.infer<typeof recurrenceWizardSchema>;

// ---------------------------------------------------------------------------
// Tipo candidato
// ---------------------------------------------------------------------------

export interface RecurrenceCandidate {
  userId: string;
  /** YYYY-MM-DD */
  date: string;
  shiftTypeId: string;
}

// ---------------------------------------------------------------------------
// Espansione date
// ---------------------------------------------------------------------------

/**
 * Espande il payload wizard in candidati (userId × data × shiftTypeId).
 * Non controlla conflitti né accede al DB.
 *
 * Logica:
 *  - weekly:   per ogni giorno in [startDate, endDate] con dayOfWeek presente in weeklyDays,
 *              aggiunge un candidato per ogni userId con il relativo shiftTypeId.
 *  - rotating: itera tutti i giorni in [startDate, endDate] assegnando in sequenza ciclica
 *              gli shiftTypeId di rotatingSequence (ogni giorno = prossimo nella sequenza).
 *              skipHolidays: non implementato (nessun calendario festivi integrato, Q_001).
 */
export function expandCandidates(p: RecurrenceWizardInput): RecurrenceCandidate[] {
  const results: RecurrenceCandidate[] = [];
  let cursor = startOfDay(parseISO(p.startDate));
  const end = startOfDay(parseISO(p.endDate));

  if (p.type === 'weekly') {
    const dayMap = new Map((p.weeklyDays ?? []).map((d) => [d.dayOfWeek, d.shiftTypeId]));
    while (cursor <= end) {
      const stId = dayMap.get(cursor.getDay());
      if (stId) {
        const date = format(cursor, 'yyyy-MM-dd');
        for (const uid of p.userIds) results.push({ userId: uid, date, shiftTypeId: stId });
      }
      cursor = addDays(cursor, 1);
    }
  } else {
    const seq = p.rotatingSequence ?? [];
    const len = Math.min(p.cycleLength ?? seq.length, seq.length);
    if (len > 0) {
      let idx = 0;
      while (cursor <= end) {
        const stId = seq[idx % len];
        if (stId) {
          const date = format(cursor, 'yyyy-MM-dd');
          for (const uid of p.userIds) results.push({ userId: uid, date, shiftTypeId: stId });
        }
        cursor = addDays(cursor, 1);
        idx++;
      }
    }
  }

  return results;
}
