/**
 * lib/jobs/sendNotificationEmail.ts — Job Inngest per l'invio di email di
 * notifica (TSK-009, aggiornato TSK-029).
 *
 * Trigger: evento 'notification/email.send'
 * Payload: {
 *   to:       string                       (destinatario)
 *   subject:  string                       (oggetto)
 *   template: EmailTemplate                (template da usare)
 *   data:     Record<string, unknown>      (dati tipizzati per il template)
 * }
 *
 * Provider:
 *   - Se RESEND_API_KEY è definita → usa Resend per l'invio reale
 *   - Altrimenti                   → stub in console (sviluppo locale)
 *
 * Template supportati (componenti React Email in lib/email-templates/):
 *   - 'shift-assigned'    : ShiftAssignedEmail
 *   - 'request-approved'  : RequestApprovedEmail
 *   - 'request-rejected'  : RequestRejectedEmail
 *   - 'swap-request'      : SwapRequestEmail
 *
 * Retry: max 3 (default Inngest).
 */

import React from 'react';
import { render } from '@react-email/render';
import { inngest } from '@/lib/inngest';
import {
  ShiftAssignedEmail,
  RequestApprovedEmail,
  RequestRejectedEmail,
  SwapRequestEmail,
  type ShiftAssignedEmailProps,
  type RequestApprovedEmailProps,
  type RequestRejectedEmailProps,
  type SwapRequestEmailProps,
} from '@/lib/email-templates';

// ---------------------------------------------------------------------------
// Tipi pubblici
// ---------------------------------------------------------------------------

export type EmailTemplate =
  'shift-assigned' | 'request-approved' | 'request-rejected' | 'swap-request';

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
// Costruzione HTML tramite React Email render()
// ---------------------------------------------------------------------------

/**
 * Seleziona il componente React Email corretto in base al template
 * e lo renderizza in HTML pronto per l'invio.
 *
 * I dati in `payload` devono rispettare le interfacce Props del template
 * corrispondente. In caso di prop mancanti, i valori di fallback garantiscono
 * che render() non sollevi eccezioni (AC: stub restituisce HTML non vuoto).
 *
 * @returns Promise<string> — HTML dell'email
 */
async function buildEmailHtml(
  template: EmailTemplate,
  payload: Record<string, unknown>
): Promise<string> {
  const appUrl =
    (payload['appUrl'] as string | undefined) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://turnly.app';

  switch (template) {
    case 'shift-assigned': {
      const props: ShiftAssignedEmailProps = {
        recipientName: (payload['recipientName'] as string) ?? '',
        date: (payload['date'] as string) ?? '',
        startTime: (payload['startTime'] as string) ?? '',
        endTime: (payload['endTime'] as string) ?? '',
        shiftTypeName:
          (payload['shiftTypeName'] as string) ?? (payload['shiftType'] as string) ?? '',
        appUrl,
      };
      return await render(React.createElement(ShiftAssignedEmail, props), { pretty: false });
    }

    case 'request-approved': {
      // exactOptionalPropertyTypes: usa spread condizionale per i campi opzionali
      const notesApproved = payload['notes'] as string | undefined;
      const props: RequestApprovedEmailProps = {
        recipientName: (payload['recipientName'] as string) ?? '',
        requestType: (payload['requestType'] as string) ?? '',
        period: (payload['period'] as string) ?? '',
        ...(notesApproved !== undefined ? { notes: notesApproved } : {}),
        appUrl,
      };
      return await render(React.createElement(RequestApprovedEmail, props), { pretty: false });
    }

    case 'request-rejected': {
      // exactOptionalPropertyTypes: usa spread condizionale per i campi opzionali
      const notesRejected = payload['notes'] as string | undefined;
      const props: RequestRejectedEmailProps = {
        recipientName: (payload['recipientName'] as string) ?? '',
        requestType: (payload['requestType'] as string) ?? '',
        period: (payload['period'] as string) ?? '',
        ...(notesRejected !== undefined ? { notes: notesRejected } : {}),
        appUrl,
      };
      return await render(React.createElement(RequestRejectedEmail, props), { pretty: false });
    }

    case 'swap-request': {
      // exactOptionalPropertyTypes: usa spread condizionale per i campi opzionali
      const requestId = payload['requestId'] as string | undefined;
      const props: SwapRequestEmailProps = {
        recipientName: (payload['recipientName'] as string) ?? '',
        requesterName: (payload['requesterName'] as string) ?? '',
        requesterShift: (payload['requesterShift'] as string) ?? '',
        targetShift: (payload['targetShift'] as string) ?? '',
        ...(requestId !== undefined ? { requestId } : {}),
        appUrl,
      };
      return await render(React.createElement(SwapRequestEmail, props), { pretty: false });
    }

    default: {
      // Template sconosciuto — non esporre payload in email (PII)
      console.error('[sendNotificationEmail] template sconosciuto:', template);
      return '<p>Hai ricevuto una notifica da Turnly. Accedi all\'app per i dettagli.</p>';
    }
  }
}

// ---------------------------------------------------------------------------
// Job Inngest
// ---------------------------------------------------------------------------

export const sendNotificationEmail = inngest.createFunction(
  {
    id: 'send-notification-email',
    name: 'Send Notification Email',
    retries: 3,
  },
  { event: 'notification/email.send' as NotificationEmailEvent['name'] },
  async ({ event, step }) => {
    const { to, subject, template, data } = event.data as NotificationEmailEvent['data'];

    await step.run('send-email', async () => {
      const html = await buildEmailHtml(template, data);

      if (process.env.RESEND_API_KEY) {
        // Provider reale: Resend
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
  }
);
