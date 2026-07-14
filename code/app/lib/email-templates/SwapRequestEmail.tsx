/**
 * lib/email-templates/SwapRequestEmail.tsx — Template email "proposta scambio turno" (TSK-029).
 *
 * Sostituisce il case 'swap-request' del vecchio buildEmailHtml inline.
 * Inviato al collega destinatario dello scambio.
 */

import React from 'react';
import { Button, Heading, Text } from '@react-email/components';
import { BaseLayout } from './base-layout';

export interface SwapRequestEmailProps {
  /** Nome completo del destinatario (collega che deve accettare/rifiutare) */
  recipientName: string;
  /** Nome completo del richiedente */
  requesterName: string;
  /**
   * Turno offerto dal richiedente, es. "Lunedì 20 lug · 08:00–16:00 (Turno Mattina)"
   */
  requesterShift: string;
  /**
   * Turno del destinatario, es. "Martedì 21 lug · 14:00–22:00 (Turno Pomeriggio)"
   */
  targetShift: string;
  /** URL dell'app per il link al CTA "Accetta / Rifiuta" */
  appUrl: string;
  /** ID della richiesta per costruire il link diretto (facoltativo) */
  requestId?: string;
}

export function SwapRequestEmail({
  recipientName,
  requesterName,
  requesterShift,
  targetShift,
  appUrl,
  requestId,
}: SwapRequestEmailProps) {
  const previewText = `${requesterName} ti ha inviato una proposta di scambio turno`;
  const ctaUrl = requestId ? `${appUrl}/requests/${requestId}` : `${appUrl}/requests`;

  return (
    <BaseLayout previewText={previewText} appUrl={appUrl}>
      <Heading style={headingStyle}>Proposta di scambio turno</Heading>

      <Text style={greetingStyle}>Ciao {recipientName},</Text>

      <Text style={bodyTextStyle}>
        <strong>{requesterName}</strong> ti ha inviato una proposta di scambio turno. Ecco il
        riepilogo:
      </Text>

      {/* Scheda di confronto turni */}
      <div style={cardStyle}>
        <div style={shiftRowStyle}>
          <div style={shiftLabelContainerStyle}>
            <span style={shiftOwnerLabelStyle}>Turno di {requesterName}</span>
            <span style={shiftDetailStyle}>{requesterShift}</span>
          </div>
        </div>
        <div style={arrowRowStyle}>
          <span style={arrowStyle}>&#8645;</span>
        </div>
        <div style={shiftRowStyle}>
          <div style={shiftLabelContainerStyle}>
            <span style={shiftOwnerLabelStyle}>Il tuo turno</span>
            <span style={shiftDetailStyle}>{targetShift}</span>
          </div>
        </div>
      </div>

      <Text style={instructionTextStyle}>
        Accedi all&apos;app per accettare o rifiutare la proposta. La risposta è necessaria entro 48
        ore, altrimenti la proposta scadrà automaticamente.
      </Text>

      <Button href={ctaUrl} style={buttonStyle}>
        Accetta o rifiuta lo scambio
      </Button>

      <Text style={footerNoteStyle}>
        Hai ricevuto questa notifica perché sei il destinatario di una proposta di scambio in{' '}
        <a href={appUrl} style={inlineLinkStyle}>
          Turnly
        </a>
        .
      </Text>
    </BaseLayout>
  );
}

// ---------------------------------------------------------------------------
// Stili
// ---------------------------------------------------------------------------

const headingStyle: React.CSSProperties = {
  color: '#7c3aed',
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
  backgroundColor: '#faf5ff',
  borderRadius: '8px',
  border: '1px solid #d8b4fe',
  padding: '16px 20px',
  marginBottom: '20px',
};

const shiftRowStyle: React.CSSProperties = {
  padding: '8px 0',
};

const shiftLabelContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
};

const shiftOwnerLabelStyle: React.CSSProperties = {
  color: '#6d28d9',
  fontWeight: 600,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const shiftDetailStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '14px',
  fontWeight: 500,
};

const arrowRowStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '4px 0',
};

const arrowStyle: React.CSSProperties = {
  color: '#7c3aed',
  fontSize: '20px',
  lineHeight: '24px',
};

const instructionTextStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#4b5563',
  lineHeight: '22px',
  margin: '0 0 20px',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#7c3aed',
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
  color: '#7c3aed',
  textDecoration: 'none',
};
