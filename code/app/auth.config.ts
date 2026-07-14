/**
 * auth.config.ts — Configurazione Auth.js v5 edge-safe.
 *
 * Questo modulo NON importa @/db, postgres-js, bcrypt o altri moduli
 * incompatibili con il runtime Edge.  Viene utilizzato da:
 *
 *   - middleware.ts  → NextAuth(authConfig) per la verifica del JWT
 *   - auth.ts        → spread {...authConfig} + override providers con
 *                      il Credentials completo (DB + bcrypt, Node.js only)
 *
 * Auth.js v5 Edge Compatibility:
 *   Il middleware deve solo verificare il JWT già emesso; non chiama mai
 *   `authorize`.  Pertanto il provider Credentials qui è uno stub vuoto
 *   (nessuna funzione DB).  L'effettiva autenticazione avviene via auth.ts
 *   in un contesto Node.js.
 *
 * Ref: https://authjs.dev/guides/edge-compatibility
 */

import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const authConfig = {
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env['SESSION_MAX_AGE'] ?? '28800'), // default 8h
  },

  // Stub edge-safe — nessuna chiamata DB.
  // L'authorize reale è definito in auth.ts (Node.js).
  providers: [Credentials({})],

  callbacks: {
    /**
     * JWT callback — arricchisce il token con campi custom al primo login.
     * token.sub è impostato automaticamente da NextAuth con user.id.
     */
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        // token.sub = user.id è gestito automaticamente da NextAuth
      }
      return token;
    },

    /**
     * Session callback — espone i campi custom del JWT nella sessione client.
     * session.user.id viene propagato da token.sub (= user.id al login).
     */
    session({ session, token }) {
      // Fix H2: propaga l'id utente — token.sub è sempre valorizzato
      // in una sessione JWT valida (impostato da NextAuth = user.id).
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      session.user.id = token.sub!;
      session.user.role = token.role as string;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // RF-A CA1: errori auth → redirect /login
  },
} satisfies NextAuthConfig;
