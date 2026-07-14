/**
 * lib/email-templates/RequestRejectedEmail.tsx — Template email "richiesta rifiutata" (TSK-029).
 *
 * Sostituisce il case 'request-rejected' del vecchio buildEmailHtml inline.
 */

import React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface RequestRejectedEmailProps {
  /** Nome completo del destinatario */
  recipientName: string;
  /** Tipo di richiesta, es. "Ferie", "Permesso", "Scambio turno" */
  requestType: string;
  /** Periodo della richiesta, es. "15 luglio 2026 – 22 luglio 2026" */
  period: string;
  /** Motivazione del rifiuto (facoltativa) */
  notes?: string;
  /** URL dell'app per il link nel CTA */
  appUrl: string;
}

export function RequestRejectedEmail({
  recipientName,
  requestType,
  period,
  notes,
  appUrl,
}: RequestRejectedEmailProps) {
  const previewText = `La tua richiesta di ${requestType} è stata rifiutata`;

  return (
    <BaseLayout previewText={previewText} appUrl={appUrl}>
      <Heading style={headingStyle}>Richiesta rifiutata</Heading>

      <Text style={greetingStyle}>Ciao {recipientName},</Text>

      <Text style={bodyTextStyle}>
        la tua richiesta è stata <strong>rifiutata</strong>.
      </Text>

      {/* Scheda riepilogo */}
      <div style={cardStyle}>
        <Row label="Tipo richiesta" value={requestType} />
        <Row label="Periodo" value={period} isLast />
      </div>

      {notes && (
        <div style={notesBoxStyle}>
          <Text style={notesLabelStyle}>Motivazione:</Text>
          <Text style={notesTextStyle}>{notes}</Text>
        </div>
      )}

      <Button href={`${appUrl}/requests`} style={buttonStyle}>
        Visualizza la richiesta
      </Button>

      <Text style={footerNoteStyle}>
        Per chiarimenti contatta il tuo responsabile o accedi a{' '}
        <a href={appUrl} style={inlineLinkStyle}>
          Turnly
        </a>
        .
      </Text>
    </BaseLayout>
  );
}

// ---------------------------------------------------------------------------
// Riga di dettaglio
// ---------------------------------------------------------------------------

function Row({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{ ...rowStyle, borderBottom: isLast ? 'none' : '1px solid #fecaca' }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '22px',
  fontWeight: 700,
  margin: '0 0 16px',
};

const greetingStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#1a1a1a',
  margin: '0 0 8px',
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '24px',
  margin: '0 0 24px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff5f5',
  borderRadius: '8px',
  border: '1px solid #fca5a5',
  padding: '16px 20px',
  marginBottom: '20px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
};

const labelStyle: React.CSSProperties = {
  color: '#b91c1c',
  fontWeight: 600,
  fontSize: '14px',
};

const valueStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '14px',
};

const notesBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef9f0',
  borderRadius: '6px',
  border: '1px solid #fdba74',
  padding: '12px 16px',
  marginBottom: '20px',
};

const notesLabelStyle: React.CSSProperties = {
  color: '#9a3412',
  fontWeight: 600,
  fontSize: '13px',
  margin: '0 0 4px',
};

const notesTextStyle: React.CSSProperties = {
  color: '#7c2d12',
  fontSize: '14px',
  lineHeight: '20px',
  margin: 0,
  fontStyle: 'italic',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#dc2626',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
  marginBottom: '24px',
};

const footerNoteStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
};

const inlineLinkStyle: React.CSSProperties = {
  color: '#dc2626',
  textDecoration: 'none',
};
