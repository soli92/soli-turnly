/**
 * app/api/inngest/route.ts — Route handler per il serving Inngest (TSK-009).
 *
 * Registra tutti i background job e li espone all'SDK Inngest tramite
 * l'adapter `inngest/next`.
 *
 * GET  /api/inngest — handshake discovery (Inngest dev server)
 * POST /api/inngest — ricezione eventi e invocazioni da Inngest Cloud
 * PUT  /api/inngest — sync delle funzioni con Inngest Cloud
 *
 * Per sviluppo locale:
 *   npx inngest-cli@latest dev --url http://localhost:3000/api/inngest
 *
 * Variabili d'ambiente necessarie in produzione:
 *   INNGEST_EVENT_KEY    — per inviare eventi
 *   INNGEST_SIGNING_KEY  — per validare le richieste in arrivo da Inngest
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { generateRecurringShifts } from '@/lib/jobs/generateRecurringShifts';
import { sendNotificationEmail } from '@/lib/jobs/sendNotificationEmail';
import { cleanOldNotifications } from '@/lib/jobs/cleanExpiredSessions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateRecurringShifts, sendNotificationEmail, cleanOldNotifications],
});
