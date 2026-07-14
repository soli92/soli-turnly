/**
 * lib/jobs/generateRecurringShifts.ts — Job Inngest per la generazione di turni
 * da ricorrenza (TSK-009).
 *
 * Trigger: evento 'shift/recurrence.trigger'
 * Payload: { recurrenceId: string, periodStart: string, periodEnd: string }
 *
 * Logica:
 *  1. Carica la ricorrenza dal DB
 *  2. Espande le date nel periodo in base a frequency e daysOfWeek (RB-11)
 *  3. Carica le assenze approvate dell'utente
 *  4. Filtra tramite validateRecurrence (skip assenze + festivi)
 *  5. Carica il tipo turno per costruire gli orari
 *  6. Crea i turni in batch nel DB
 *  7. Registra l'audit log
 *
 * Regole di business applicate:
 *  - RB-11: skip assenze approvate e festivi
 *
 * Retry: max 3 (configurato in createFunction options).
 */

import { inngest } from '@/lib/inngest';
import { db } from '@/db';
import { shifts, recurrences, absences, shiftTypes } from '@/db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { validateRecurrence } from '@/lib/rules';
import { insertAuditLog } from '@/lib/audit';
import { parseISO, addDays, startOfDay, differenceInDays } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { APP_TIMEZONE } from '@/lib/date';

// ---------------------------------------------------------------------------
// Tipi evento
// ---------------------------------------------------------------------------

interface RecurrenceTriggerEvent {
  name: 'shift/recurrence.trigger';
  data: {
    /** UUID della ricorrenza da espandere. */
    recurrenceId: string;
    /** Data inizio del periodo di espansione (YYYY-MM-DD). */
    periodStart: string;
    /** Data fine del periodo di espansione (YYYY-MM-DD). */
    periodEnd: string;
  };
}

// ---------------------------------------------------------------------------
// Helper: espansione date
// ---------------------------------------------------------------------------

/**
 * Espande le date candidate in base a frequency e daysOfWeek della ricorrenza.
 *
 * Logica per frequenza:
 * - weekly:   ogni settimana, tutte le occorrenze dei giorni in daysOfWeek
 * - biweekly: ogni 2 settimane (calcolato dalla startDate della ricorrenza),
 *             tutte le occorrenze dei giorni in daysOfWeek
 * - monthly:  prima occorrenza di ciascun giorno in daysOfWeek per ogni mese
 *             del periodo (un'occorrenza per giorno per mese)
 *
 * @param rec         Ricorrenza con frequency, daysOfWeek, startDate, endDate
 * @param periodStart Inizio del periodo richiesto (YYYY-MM-DD)
 * @param periodEnd   Fine del periodo richiesto (YYYY-MM-DD)
 * @returns           Array di Date (midnight UTC) corrispondenti ai candidati
 */
function expandDates(
  rec: {
    frequency: 'weekly' | 'biweekly' | 'monthly';
    daysOfWeek: number[];
    startDate: string;
    endDate: string | null;
  },
  periodStart: string,
  periodEnd: string
): Date[] {
  const recStart = parseISO(rec.startDate);
  const recEnd = rec.endDate ? parseISO(rec.endDate) : parseISO(periodEnd);

  // Intersezione tra il periodo richiesto e il range di validità della ricorrenza
  const rangeStart = startOfDay(
    recStart > parseISO(periodStart) ? recStart : parseISO(periodStart)
  );
  const rangeEnd = startOfDay(recEnd < parseISO(periodEnd) ? recEnd : parseISO(periodEnd));

  if (rangeStart > rangeEnd) return [];

  const dowSet = new Set(rec.daysOfWeek);
  const dates: Date[] = [];

  if (rec.frequency === 'weekly') {
    // Ogni giorno nel range: includi se il giorno della settimana è in daysOfWeek
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      if (dowSet.has(cursor.getDay())) {
        dates.push(new Date(cursor));
      }
      cursor = addDays(cursor, 1);
    }
  } else if (rec.frequency === 'biweekly') {
    // Ogni 2 settimane: settimana "attiva" se il numero di settimane dalla
    // startDate della ricorrenza è pari (0, 2, 4, …)
    const recStartDay = startOfDay(recStart);
    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      if (dowSet.has(cursor.getDay())) {
        const daysFromStart = differenceInDays(startOfDay(cursor), recStartDay);
        // Settimane complete dalla startDate; settimana pari = attiva
        const weekIndex = Math.floor(Math.max(0, daysFromStart) / 7);
        if (weekIndex % 2 === 0) {
          dates.push(new Date(cursor));
        }
      }
      cursor = addDays(cursor, 1);
    }
  } else {
    // monthly: prima occorrenza di ciascun giorno-della-settimana per ogni mese
    // Raggruppa per mese: appena trova il giorno-della-settimana, lo prende e lo
    // segna come "già preso" per quel mese.
    let currentMonthKey = -1;
    const seenThisMonth = new Set<number>();

    let cursor = new Date(rangeStart);
    while (cursor <= rangeEnd) {
      const monthKey = cursor.getFullYear() * 100 + cursor.getMonth();
      if (monthKey !== currentMonthKey) {
        currentMonthKey = monthKey;
        seenThisMonth.clear();
      }
      const dayOfWeek = cursor.getDay();
      if (dowSet.has(dayOfWeek) && !seenThisMonth.has(dayOfWeek)) {
        dates.push(new Date(cursor));
        seenThisMonth.add(dayOfWeek);
      }
      cursor = addDays(cursor, 1);
    }
  }

  return dates;
}

// ---------------------------------------------------------------------------
// Job Inngest
// ---------------------------------------------------------------------------

export const generateRecurringShifts = inngest.createFunction(
  {
    id: 'generate-recurring-shifts',
    name: 'Generate Recurring Shifts',
    retries: 3,
  },
  { event: 'shift/recurrence.trigger' as RecurrenceTriggerEvent['name'] },
  async ({ event, step }) => {
    const { recurrenceId, periodStart, periodEnd } = event.data as RecurrenceTriggerEvent['data'];

    // ------------------------------------------------------------------
    // Step 1: Carica la ricorrenza
    // ------------------------------------------------------------------
    const recurrence = await step.run('load-recurrence', async () => {
      const rec = await db.query.recurrences.findFirst({
        where: and(eq(recurrences.id, recurrenceId), eq(recurrences.active, true)),
      });
      if (!rec) throw new Error(`Ricorrenza ${recurrenceId} non trovata o non attiva`);
      return rec;
    });

    // ------------------------------------------------------------------
    // Step 2: Espandi le date nel periodo
    // ------------------------------------------------------------------
    const candidateDates = await step.run('expand-dates', async () => {
      return expandDates(recurrence, periodStart, periodEnd);
    });

    if (candidateDates.length === 0) {
      return { generated: 0, skipped: 0, message: 'Nessuna data candidata nel periodo' };
    }

    // ------------------------------------------------------------------
    // Step 3: Carica le assenze approvate dell'utente nel periodo
    //         (RB-11: skip assenze approvate)
    // ------------------------------------------------------------------
    const userAbsences = await step.run('load-absences', async () => {
      return db
        .select({
          id: absences.id,
          userId: absences.userId,
          startDate: absences.startDate,
          endDate: absences.endDate,
          status: absences.status,
        })
        .from(absences)
        .where(
          and(
            eq(absences.userId, recurrence.userId),
            eq(absences.status, 'approved'),
            // Assenze che si sovrappongono al periodo di interesse
            lte(absences.startDate, periodEnd),
            gte(absences.endDate, periodStart)
          )
        );
    });

    // ------------------------------------------------------------------
    // Step 4: Filtra conflitti con assenze (RB-11) e festivi
    //         Per ora nessuna lista festivi esterna: passare array vuoto.
    //         Nota: l'integrazione con un calendario festivi può essere
    //         aggiunta in un TSK dedicato (Q_001 aperta).
    // ------------------------------------------------------------------
    const filterResult = await step.run('filter-conflicts', async () => {
      // NOTE: Inngest serializza i return value degli step come JSON → Date[] diventa string[].
      // Convertiamo le date string -> Date prima di passarle alla pure function.
      const candidateDateObjs = (candidateDates as unknown as string[]).map((d) => new Date(d));
      return validateRecurrence(recurrence.userId, candidateDateObjs, userAbsences, []);
    });

    const validDates = filterResult.valid.map((c) => c.date);
    const skippedCount = filterResult.skipped.length;

    if (validDates.length === 0) {
      return {
        generated: 0,
        skipped: skippedCount,
        message: 'Tutte le date candidate sono state escluse per conflitti',
      };
    }

    // ------------------------------------------------------------------
    // Step 5: Carica il tipo turno per costruire gli orari
    // ------------------------------------------------------------------
    const shiftType = await step.run('load-shift-type', async () => {
      const st = await db.query.shiftTypes.findFirst({
        where: eq(shiftTypes.id, recurrence.shiftTypeId),
      });
      if (!st) throw new Error(`ShiftType ${recurrence.shiftTypeId} non trovato`);
      return st;
    });

    // ------------------------------------------------------------------
    // Step 6: Crea i turni in batch
    // ------------------------------------------------------------------
    const createdShifts = await step.run('create-shifts', async () => {
      const now = new Date();
      const shiftValues = validDates.map((date) => {
        // Costruisce startDt/endDt combinando la data candidata con
        // defaultStartTime / defaultEndTime del tipo turno
        // NOTE: validDates contiene stringhe YYYY-MM-DD (serializzate da Inngest step).
        const dateStr = typeof date === 'string' ? date : (date as Date).toISOString().slice(0, 10);

        const parseTime = (t: string): { h: number; m: number } => {
          const [h, m] = t.split(':').map(Number);
          return { h: h ?? 0, m: m ?? 0 };
        };

        const start = parseTime(shiftType.defaultStartTime);
        const end = parseTime(shiftType.defaultEndTime);

        // DST-safe: interpreta gli orari in APP_TIMEZONE (Europe/Rome) anziché UTC.
        // TZDate.tz costruisce un istante UTC dal wall-clock locale, gestendo
        // correttamente il cambio ora legale (T-DOM-08).
        const [yearStr, monthStr, dayStr] = dateStr.split('-');
        const year = parseInt(yearStr!, 10);
        const month = parseInt(monthStr!, 10) - 1; // TZDate.tz usa mesi 0-indexed
        const day = parseInt(dayStr!, 10);

        const startDt = new Date(
          TZDate.tz(APP_TIMEZONE, year, month, day, start.h, start.m, 0, 0).getTime()
        );
        let endDt = new Date(
          TZDate.tz(APP_TIMEZONE, year, month, day, end.h, end.m, 0, 0).getTime()
        );

        // Se endDt <= startDt → turno notturno (attraversa la mezzanotte)
        if (endDt <= startDt) {
          endDt = new Date(
            TZDate.tz(APP_TIMEZONE, year, month, day + 1, end.h, end.m, 0, 0).getTime()
          );
        }

        return {
          userId: recurrence.userId,
          shiftTypeId: recurrence.shiftTypeId,
          date: dateStr,
          startDt,
          endDt,
          origin: 'recurrence' as const,
          status: 'planned' as const,
          createdBy: recurrence.createdBy,
          createdAt: now,
          updatedAt: now,
        };
      });

      const inserted = await db.insert(shifts).values(shiftValues).returning({ id: shifts.id });
      return inserted;
    });

    // ------------------------------------------------------------------
    // Step 7: Audit log — una entry per ogni turno generato
    // ------------------------------------------------------------------
    await step.run('insert-audit-log', async () => {
      await Promise.all(
        createdShifts.map((s) =>
          insertAuditLog({
            actorId: recurrence.createdBy,
            action: 'shift.create',
            entityType: 'shift',
            entityId: s.id,
            after: {
              origin: 'recurrence',
              recurrenceId,
              periodStart,
              periodEnd,
            },
          })
        )
      );
    });

    return {
      generated: createdShifts.length,
      skipped: skippedCount,
      recurrenceId,
      periodStart,
      periodEnd,
    };
  }
);
