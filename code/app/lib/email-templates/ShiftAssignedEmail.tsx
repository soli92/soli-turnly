/**
 * lib/email-templates/ShiftAssignedEmail.tsx — Template email "turno assegnato" (TSK-029).
 *
 * Sostituisce il case 'shift-assigned' del vecchio buildEmailHtml inline.
 * Renderizzato con `render(<ShiftAssignedEmail {...props} />)` di @react-email/render.
 */

import React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface ShiftAssignedEmailProps {
  /** Nome completo del destinatario */
  recipientName: string;
  /** Data formattata, es. "Lunedì 15 luglio 2026" */
  date: string;
  /** Orario inizio, es. "08:00" */
  startTime: string;
  /** Orario fine, es. "16:00" */
  endTime: string;
  /** Nome del tipo di turno, es. "Turno Mattina" */
  shiftTypeName: string;
  /** URL dell'app per il link nel CTA */
  appUrl: string;
}

export function ShiftAssignedEmail({
  recipientName,
  date,
  startTime,
  endTime,
  shiftTypeName,
  appUrl,
}: ShiftAssignedEmailProps) {
  const previewText = `Nuovo turno assegnato: ${date} ${startTime}–${endTime}`;

  return (
    <BaseLayout previewText={previewText} appUrl={appUrl}>
      <Heading style={headingStyle}>Turno assegnato</Heading>

      <Text style={greetingStyle}>Ciao {recipientName},</Text>

      <Text style={bodyTextStyle}>ti è stato assegnato un nuovo turno nel tuo calendario.</Text>

      {/* Scheda riepilogo turno */}
      <div style={cardStyle}>
        <Row label="Data" value={date} />
        <Row label="Orario" value={`${startTime} – ${endTime}`} />
        <Row label="Tipo turno" value={shiftTypeName} />
      </div>

      <Button href={`${appUrl}/shifts`} style={buttonStyle}>
        Visualizza il turno
      </Button>

      <Text style={footerNoteStyle}>
        Puoi consultare tutti i tuoi turni nella sezione{' '}
        <a href={`${appUrl}/shifts`} style={inlineLinkStyle}>
          Calendario
        </a>{' '}
        dell&apos;applicazione.
      </Text>
    </BaseLayout>
  );
}

// ---------------------------------------------------------------------------
// Riga di dettaglio nella scheda riepilogo
// ---------------------------------------------------------------------------

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  color: '#2563eb',
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
  backgroundColor: '#f0f7ff',
  borderRadius: '8px',
  border: '1px solid #bfdbfe',
  padding: '16px 20px',
  marginBottom: '24px',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
  borderBottom: '1px solid #dbeafe',
};

const labelStyle: React.CSSProperties = {
  color: '#1d4ed8',
  fontWeight: 600,
  fontSize: '14px',
};

const valueStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '14px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#2563eb',
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
  color: '#2563eb',
  textDecoration: 'none',
};
