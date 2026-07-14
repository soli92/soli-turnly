/**
 * lib/email-templates/RequestApprovedEmail.tsx — Template email "richiesta approvata" (TSK-029).
 *
 * Sostituisce il case 'request-approved' del vecchio buildEmailHtml inline.
 */

import React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface RequestApprovedEmailProps {
  /** Nome completo del destinatario */
  recipientName: string;
  /** Tipo di richiesta, es. "Ferie", "Permesso", "Scambio turno" */
  requestType: string;
  /** Periodo della richiesta, es. "15 luglio 2026 – 22 luglio 2026" */
  period: string;
  /** Note facoltative del responsabile */
  notes?: string;
  /** URL dell'app per il link nel CTA */
  appUrl: string;
}

export function RequestApprovedEmail({
  recipientName,
  requestType,
  period,
  notes,
  appUrl,
}: RequestApprovedEmailProps) {
  const previewText = `La tua richiesta di ${requestType} è stata approvata`;

  return (
    <BaseLayout previewText={previewText} appUrl={appUrl}>
      <Heading style={headingStyle}>Richiesta approvata</Heading>

      <Text style={greetingStyle}>Ciao {recipientName},</Text>

      <Text style={bodyTextStyle}>
        la tua richiesta è stata <strong>approvata</strong>.
      </Text>

      {/* Scheda riepilogo */}
      <div style={cardStyle}>
        <Row label="Tipo richiesta" value={requestType} />
        <Row label="Periodo" value={period} isLast />
      </div>

      {notes && (
        <div style={notesBoxStyle}>
          <Text style={notesLabelStyle}>Note del responsabile:</Text>
          <Text style={notesTextStyle}>{notes}</Text>
        </div>
      )}

      <Button href={`${appUrl}/requests`} style={buttonStyle}>
        Visualizza la richiesta
      </Button>

      <Text style={footerNoteStyle}>
        Accedi a{' '}
        <a href={appUrl} style={inlineLinkStyle}>
          Turnly
        </a>{' '}
        per consultare tutti i tuoi documenti.
      </Text>
    </BaseLayout>
  );
}

// ---------------------------------------------------------------------------
// Riga di dettaglio
// ---------------------------------------------------------------------------

function Row({ label, value, isLast = false }: { label: string; value: string; isLast?: boolean }) {
  return (
    <div style={{ ...rowStyle, borderBottom: isLast ? 'none' : '1px solid #d1fae5' }}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  color: '#16a34a',
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
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  border: '1px solid #86efac',
  padding: '16px 20px',
  marginBottom: '20px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
};

const labelStyle: React.CSSProperties = {
  color: '#15803d',
  fontWeight: 600,
  fontSize: '14px',
};

const valueStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '14px',
};

const notesBoxStyle: React.CSSProperties = {
  backgroundColor: '#fefce8',
  borderRadius: '6px',
  border: '1px solid #fde68a',
  padding: '12px 16px',
  marginBottom: '20px',
};

const notesLabelStyle: React.CSSProperties = {
  color: '#92400e',
  fontWeight: 600,
  fontSize: '13px',
  margin: '0 0 4px',
};

const notesTextStyle: React.CSSProperties = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '20px',
  margin: 0,
  fontStyle: 'italic',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
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
  color: '#16a34a',
  textDecoration: 'none',
};
