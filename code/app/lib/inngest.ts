/**
 * lib/inngest.ts — Client Inngest per i background job di Turnly (TSK-009).
 *
 * Tutti i job importano questo client singleton per registrarsi
 * e inviare eventi.
 *
 * Il client usa l'ID 'turnly' come identificatore univoco per la dashboard
 * Inngest e per il routing degli eventi.
 *
 * Variabili d'ambiente richieste (in produzione):
 *   INNGEST_EVENT_KEY   — chiave per inviare eventi al cloud Inngest
 *   INNGEST_SIGNING_KEY — firma per validare le richieste HTTP da Inngest
 *
 * In sviluppo locale (senza env vars), Inngest usa la modalità dev locale
 * con inngest dev server (npx inngest-cli@latest dev).
 */

import { Inngest } from 'inngest';

export const inngest = new Inngest({ id: 'turnly' });
