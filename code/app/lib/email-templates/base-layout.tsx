/**
 * lib/email-templates/base-layout.tsx — Layout comune per le email di Turnly (TSK-029).
 *
 * Wrappa tutti i template email con:
 *   - HTML boilerplate compatibile con client di posta
 *   - Header con logo/brand Turnly
 *   - Footer con link unsubscribe e indirizzo
 *
 * Usato internamente dai singoli template; non esportato nell'index pubblico.
 */

import React from 'react';
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface BaseLayoutProps {
  previewText: string;
  children: React.ReactNode;
  appUrl?: string;
}

const brandColor = '#2563eb';

export function BaseLayout({
  previewText,
  children,
  appUrl = 'https://turnly.app',
}: BaseLayoutProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Text style={logoStyle}>Turnly</Text>
          </Section>

          <Hr style={dividerStyle} />

          {/* Contenuto del template figlio */}
          <Section style={contentStyle}>{children}</Section>

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Hai ricevuto questa email perché sei registrato su{' '}
              <Link href={appUrl} style={linkStyle}>
                Turnly
              </Link>
              .
            </Text>
            <Text style={footerTextStyle}>
              <Link href={`${appUrl}/profile`} style={linkStyle}>
                Gestisci le notifiche email
              </Link>{' '}
              &middot;{' '}
              <Link href={`${appUrl}/profile`} style={linkStyle}>
                Disiscrivi
              </Link>
            </Text>
            <Text style={footerTextStyle}>
              &copy; {new Date().getFullYear()} Turnly &mdash; tutti i diritti riservati.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Stili inline (email client compatibility)
// ---------------------------------------------------------------------------

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f4f7fb',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: '32px 0',
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  maxWidth: '600px',
  margin: '0 auto',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  backgroundColor: brandColor,
  padding: '24px 32px',
};

const logoStyle: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700,
  letterSpacing: '-0.5px',
  margin: 0,
};

const dividerStyle: React.CSSProperties = {
  borderColor: '#e5e7eb',
  borderTopWidth: 1,
  margin: 0,
};

const contentStyle: React.CSSProperties = {
  padding: '32px 32px 24px',
};

const footerStyle: React.CSSProperties = {
  padding: '16px 32px 24px',
  backgroundColor: '#f9fafb',
};

const footerTextStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '4px 0',
};

const linkStyle: React.CSSProperties = {
  color: brandColor,
  textDecoration: 'none',
};
