/**
 * types/next-auth.d.ts — Type augmentation per Auth.js v5 (NextAuth).
 *
 * Estende le interfacce User, Session e JWT con i campi custom
 * definiti in auth.ts (role, firstName, lastName).
 *
 * Ref: https://authjs.dev/getting-started/typescript
 */

import 'next-auth';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Estende l'interfaccia User con i campi restituiti da `authorize`.
   * Necessario per evitare typecast in auth.ts callbacks.
   */
  interface User {
    role: string;
    firstName: string;
    lastName: string;
  }

  /**
   * Estende l'interfaccia Session con i campi propagati dal JWT.
   * Disponibile via `session.user.role`, `session.user.firstName`, ecc.
   */
  interface Session {
    user: {
      role: string;
      firstName: string;
      lastName: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * Estende il JWT token con i campi custom serializzati nel cookie.
   */
  interface JWT {
    role?: string;
    firstName?: string;
    lastName?: string;
  }
}
