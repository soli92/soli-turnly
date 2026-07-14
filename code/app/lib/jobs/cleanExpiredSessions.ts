/**
 * lib/jobs/cleanExpiredSessions.ts — Job Inngest cron per la pulizia delle
 * notifiche lette più vecchie di 30 giorni (TSK-009).
 *
 * Cron: ogni notte alle 02:00 Europe/Rome
 *   → espressione: TZ=Europe/Rome 0 2 * * *
 *
 * Nota architetturale:
 *   L'autenticazione usa JWT (stateless, via Auth.js v5 strategy: 'jwt'),
 *   quindi non esiste una tabella `sessions` da pulire nel DB.
 *   Il job pulisce invece le notifiche già lette (readAt IS NOT NULL)
 *   più vecchie di 30 giorni, che non hanno più valore operativo e
 *   saturerebbero la tabella `notifications` nel tempo.
 *
 * Comportamento su DB vuoto:
 *   La DELETE con WHERE non genera errori se non ci sono righe da eliminare.
 *   Il job termina correttamente restituendo { deleted: 0 }.
 */

import { inngest } from '@/lib/inngest';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { and, isNotNull, lt } from 'drizzle-orm';

export const cleanOldNotifications = inngest.createFunction(
  {
    id: 'clean-old-notifications',
    name: 'Clean Old Notifications',
    // Nessun retry per i job di manutenzione: se fallisce, ritenta la notte successiva
    retries: 0,
  },
  {
    // TZ=Europe/Rome: Inngest supporta la timezone nell'espressione cron
    // con il prefisso TZ=<iana_timezone>
    cron: 'TZ=Europe/Rome 0 2 * * *',
  },
  async ({ step }) => {
    const result = await step.run('delete-old-read-notifications', async () => {
      // Cutoff: 30 giorni fa rispetto all'ora di esecuzione del job
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const deleted = await db
        .delete(notifications)
        .where(
          and(
            // Solo notifiche già lette (readAt IS NOT NULL)
            isNotNull(notifications.readAt),
            // Lette più di 30 giorni fa
            lt(notifications.readAt, cutoff)
          )
        )
        .returning({ id: notifications.id });

      return { deleted: deleted.length, cutoff: cutoff.toISOString() };
    });

    return result;
  }
);
