/**
 * lib/jobs/sendNotificationEmail.ts — Job Inngest per l'invio di email di
 * notifica (TSK-009).
 *
 * Trigger: evento 'notification/email.send'
 * Payload: {
 *   to:       string                       (destinatario)
 *   subject:  string                       (oggetto)
 *   template: EmailTemplate                (template da usare)
 *   data:     Record<string, unknown>      (dati per il template)
 * }
 *
 * Provider:
 *   - Se RESEND_API_KEY è definita → usa Resend per l'invio reale
 *   - Altrimenti                   → stub in console (sviluppo locale)
 *
 * Template supportati:
 *   - 'shift-assigned'    : assegnazione turno a dipendente
 *   - 'request-approved'  : approvazione richiesta
 *   - 'request-rejected'  : rifiuto richiesta
 *   - 'swap-request'      : proposta scambio turno tra colleghi
 *
 * Retry: max 3 (default Inngest).
 */

import { inngest } from '@/lib/inngest';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type EmailTemplate =
  | 'shift-assigned'
  | 'request-approved'
  | 'request-rejected'
  | 'swap-request';

interface NotificationEmailEvent {
  name: 'notification/email.send';
  data: {
    to: string;
    subject: string;
    template: EmailTemplate;
    data: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Helpers per la costruzione dell'HTML dai template
// ---------------------------------------------------------------------------

/**
 * Costruisce il corpo HTML dell'email in base al template e ai dati.
 * Implementazione minimale — in produzione sostituire con un motore
 * template più robusto (Handlebars, React Email, ecc.).
 */
function buildEmailHtml(template: EmailTemplate, data: Record<string, unknown>): string {
  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 600px;
    margin: 0 auto;
    padding: 32px 24px;
  `;

  switch (template) {
    case 'shift-assigned':
      return `
        <div style="${baseStyle}">
          <h2 style="color:#2563eb;">Turno assegnato</h2>
          <p>È stato assegnato un nuovo turno al tuo calendario.</p>
          <ul>
            <li><strong>Data:</strong> ${data['date'] ?? ''}</li>
            <li><strong>Orario:</strong> ${data['startTime'] ?? ''} – ${data['endTime'] ?? ''}</li>
            <li><strong>Tipo turno:</strong> ${data['shiftType'] ?? ''}</li>
          </ul>
          <p>Accedi a <a href="${data['appUrl'] ?? '#'}">Turnly</a> per visualizzare i dettagli.</p>
        </div>
      `;

    case 'request-approved':
      return `
        <div style="${baseStyle}">
          <h2 style="color:#16a34a;">Richiesta approvata</h2>
          <p>La tua richiesta è stata <strong>approvata</strong>.</p>
          <ul>
            <li><strong>Tipo:</strong> ${data['requestType'] ?? ''}</li>
            <li><strong>Periodo:</strong> ${data['period'] ?? ''}</li>
          </ul>
          ${data['notes'] ? `<p><em>Note del responsabile:</em> ${data['notes']}</p>` : ''}
          <p>Accedi a <a href="${data['appUrl'] ?? '#'}">Turnly</a> per i dettagli.</p>
        </div>
      `;

    case 'request-rejected':
      return `
        <div style="${baseStyle}">
          <h2 style="color:#dc2626;">Richiesta rifiutata</h2>
          <p>La tua richiesta è stata <strong>rifiutata</strong>.</p>
          <ul>
            <li><strong>Tipo:</strong> ${data['requestType'] ?? ''}</li>
            <li><strong>Periodo:</strong> ${data['period'] ?? ''}</li>
          </ul>
          ${data['notes'] ? `<p><em>Motivazione:</em> ${data['notes']}</p>` : ''}
          <p>Per chiarimenti, contatta il responsabile o accedi a <a href="${data['appUrl'] ?? '#'}">Turnly</a>.</p>
        </div>
      `;

    case 'swap-request':
      return `
        <div style="${baseStyle}">
          <h2 style="color:#7c3aed;">Richiesta scambio turno</h2>
          <p><strong>${data['requesterName'] ?? 'Un collega'}</strong> ti ha inviato una proposta di scambio turno.</p>
          <ul>
            <li><strong>Il suo turno:</strong> ${data['requesterShift'] ?? ''}</li>
            <li><strong>Il tuo turno:</strong> ${data['targetShift'] ?? ''}</li>
          </ul>
          <p>Accedi a <a href="${data['appUrl'] ?? '#'}">Turnly</a> per accettare o rifiutare.</p>
        </div>
      `;

    default:
      return `
        <div style="${baseStyle}">
          <p>${JSON.stringify(data)}</p>
        </div>
      `;
  }
}

// ---------------------------------------------------------------------------
// Job Inngest
// ---------------------------------------------------------------------------

export const sendNotificationEmail = inngest.createFunction(
  {
    id: 'send-notification-email',
    retries: 3,
  },
  { event: 'notification/email.send' as NotificationEmailEvent['name'] },
  async ({ event, step }) => {
    const { to, subject, template, data } = event.data as NotificationEmailEvent['data'];

    await step.run('send-email', async () => {
      const html = buildEmailHtml(template, data);

      if (process.env.RESEND_API_KEY) {
        // Provider reale: Resend
        // Nota: 'resend' deve essere installato nel progetto (npm install resend).
        // L'import dinamico evita errori a runtime se il pacchetto non è installato
        // ma la variabile d'ambiente non è impostata (sviluppo senza Resend).
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const fromAddress = process.env.RESEND_FROM_EMAIL ?? 'noreply@turnly.app';

        const result = await resend.emails.send({
          from: fromAddress,
          to,
          subject,
          html,
        });

        if (result.error) {
          throw new Error(`Resend error: ${result.error.message}`);
        }

        return { provider: 'resend', emailId: result.data?.id };
      } else {
        // Stub per sviluppo locale (nessuna variabile RESEND_API_KEY)
        // eslint-disable-next-line no-console
        console.log('[email stub] sendNotificationEmail', {
          to,
          subject,
          template,
          data,
          html: html.slice(0, 200) + '…',
        });

        return { provider: 'stub', emailId: null };
      }
    });

    return { to, subject, template };
  },
);
