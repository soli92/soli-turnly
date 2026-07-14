/**
 * types/next-auth.d.ts — Type augmentation per Auth.js v5 (NextAuth).
 *
 * Estende le interfacce User, Session e JWT con i campi custom
 * definiti in auth.config.ts (id, role, firstName, lastName).
 *
 * Fix H2: aggiunto `id: string` a Session.user.
 * DefaultSession['user'] non include `id`; il campo viene propagato
 * esplicitamente nel session callback (token.sub → session.user.id).
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
   * Disponibile via `session.user.id`, `session.user.role`, ecc.
   */
  interface Session {
    user: {
      /** Identificativo univoco dell'utente (= token.sub propagato dal session callback). */
      id: string;
      role: string;
      firstName: string;
      lastName: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  /**
   * Estende il JWT token con i campi custom serializzati nel cookie.
   * Nota: token.sub (standard JWT claim) contiene user.id — non è
   * necessario ridefinirlo qui.
   */
  interface JWT {
    role?: string;
    firstName?: string;
    lastName?: string;
  }
}
