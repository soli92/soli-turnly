/**
 * lib/auth/index.ts — Helper server-side per Auth.js v5.
 *
 * Fornisce re-export delle funzioni Auth.js e helper tipizzati
 * per la verifica di sessione e ruolo nei Server Component e
 * nelle Route Handler.
 *
 * Utilizzo:
 *   import { requireAuth, requireAdmin } from '@/lib/auth'
 *
 *   // In un Server Component:
 *   const session = await requireAuth()     // → Session | redirect /login
 *   const session = await requireAdmin()    // → Session (admin) | redirect
 *
 *   // In una Route Handler:
 *   const session = await requireAuthOrUnauthorized()
 */

import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth, signIn, signOut } from '@/auth';

// Re-export delle funzioni base Auth.js
export { auth, signIn, signOut };

// ----------------------------------------------------------------
// requireAuth
// ----------------------------------------------------------------

/**
 * Richiede che l'utente sia autenticato.
 *
 * Se non autenticato → redirect('/login').
 * Restituisce la sessione tipizzata (con role, firstName, lastName).
 *
 * Usato in Server Component delle route protette.
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }
  return session;
}

// ----------------------------------------------------------------
// requireAdmin
// ----------------------------------------------------------------

/**
 * Richiede che l'utente sia autenticato con ruolo 'admin'.
 *
 * Se non autenticato → redirect('/login').
 * Se autenticato ma non admin → redirect('/calendar').
 * Restituisce la sessione tipizzata.
 *
 * Usato in Server Component delle route /admin/*.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== 'admin') {
    redirect('/calendar');
  }
  return session;
}

// ----------------------------------------------------------------
// requireAuthOrUnauthorized — per Route Handler
// ----------------------------------------------------------------

/**
 * Verifica autenticazione in una Route Handler API.
 *
 * Restituisce `{ session }` se autenticato,
 * oppure `{ response }` con NextResponse 401 da ritornare immediatamente.
 *
 * Utilizzo:
 * ```ts
 * const check = await requireAuthOrUnauthorized()
 * if ('response' in check) return check.response
 * const { session } = check
 * ```
 */
export async function requireAuthOrUnauthorized(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await auth();
  if (!session) {
    return {
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { session };
}

// ----------------------------------------------------------------
// requireAdminOrForbidden — per Route Handler
// ----------------------------------------------------------------

/**
 * Verifica autenticazione e ruolo admin in una Route Handler API.
 *
 * Restituisce `{ session }` se admin,
 * oppure `{ response }` con NextResponse 401/403 da ritornare immediatamente.
 */
export async function requireAdminOrForbidden(): Promise<
  { session: Session } | { response: NextResponse }
> {
  const session = await auth();
  if (!session) {
    return {
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  if (session.user.role !== 'admin') {
    return {
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    };
  }
  return { session };
}
