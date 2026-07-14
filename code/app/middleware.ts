/**
 * middleware.ts — RBAC middleware Auth.js v5.
 *
 * Protezione route basata su sessione JWT e ruolo utente.
 *
 * Logica RBAC (RF-A CA2):
 * - /login, /api/auth/*     : pubbliche; se autenticato → redirect dashboard
 * - /admin/*, /api/admin/*  : solo ruolo 'admin'; altrimenti 403 API / redirect /calendar
 * - tutto il resto          : richiede autenticazione; se non autenticato → redirect /login
 *
 * Sicurezza:
 * - RF-A CA2: verifica ruolo su ogni request
 * - RF-A CA3: token scaduto → req.auth è null → redirect /login / 401 API
 * - Audit log su write: implementato in TSK-010 come middleware applicativo separato
 *
 * Fix H1 — Edge compatibility:
 * Importa da auth.config.ts (edge-safe) invece di auth.ts che trascina
 * @/db (postgres-js) e bcrypt nel bundle Edge.
 * Ref: https://authjs.dev/guides/edge-compatibility
 */

import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;
  const isAuthenticated = !!req.auth;

  // ----------------------------------------------------------------
  // Rotte Auth.js (/api/auth/*): sempre pass-through, anche da autenticati.
  // Il SessionProvider chiama /api/auth/session dopo il login — non va
  // reindirizzato al dashboard o riceve HTML invece di JSON.
  // ----------------------------------------------------------------
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // ----------------------------------------------------------------
  // Pagina di login: se già autenticato, redirect al dashboard di ruolo.
  // ----------------------------------------------------------------
  if (pathname.startsWith('/login')) {
    if (isAuthenticated) {
      const redirectUrl = role === 'admin' ? '/admin/dashboard' : '/calendar';
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // ----------------------------------------------------------------
  // Richiede autenticazione — utente non autenticato
  // ----------------------------------------------------------------
  if (!isAuthenticated) {
    // API: rispondi 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // Web: redirect /login con callbackUrl
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ----------------------------------------------------------------
  // Rotte admin: /admin/*, /api/admin/* — solo ruolo 'admin'
  // RF-A CA2, T-SEC-02
  // ----------------------------------------------------------------
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/calendar', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Applica middleware a tutte le route eccetto:
     * - _next/static  (file statici)
     * - _next/image   (ottimizzazione immagini)
     * - favicon.ico
     * - asset statici (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
