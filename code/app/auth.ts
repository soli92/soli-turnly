/**
 * auth.ts — Auth.js v5 (NextAuth) configuration.
 *
 * Strategia: JWT (stateless) con scadenza configurabile via SESSION_MAX_AGE.
 * Provider: Credentials (email/password) con bcrypt.
 *
 * Sicurezza:
 * - RF-A CA1: authorize restituisce null sia per utente inesistente sia per
 *   password errata — il client NON distingue quale campo è sbagliato.
 * - RF-A CA2: il ruolo è propagato nel JWT e verificato dal middleware RBAC.
 * - RF-A CA3: sessione scaduta → token non valido → middleware redirect /login.
 *
 * Note TSK-002: db.query.users richiede lo schema completo (tabella users).
 * I tipi TS verranno risolti al merge di TSK-002.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
// TSK-002: users sarà esportata dallo schema completo — errori TS temporanei attesi.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// ----------------------------------------------------------------
// Validazione input credenziali (schema Zod)
// ----------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ----------------------------------------------------------------
// NextAuth export principale
// ----------------------------------------------------------------

export const { auth, handlers, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env['SESSION_MAX_AGE'] ?? '28800'), // default 8h
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        // Validazione input
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Ricerca utente nel DB (TSK-002 popola la tabella users)
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        // RF-A CA1: messaggio generico — non rivela quale campo è errato
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * JWT callback — arricchisce il token con campi custom al primo login.
     * I campi role/firstName/lastName sono propagati a ogni richiesta successiva.
     */
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },

    /**
     * Session callback — espone i campi custom del JWT nella sessione client.
     * Il type augmentation in types/next-auth.d.ts rende role/firstName/lastName
     * disponibili in session.user senza typecast.
     */
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.firstName = token.firstName as string;
      session.user.lastName = token.lastName as string;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // RF-A CA1: errori auth → redirect /login (no pagina errore separata)
  },
});
