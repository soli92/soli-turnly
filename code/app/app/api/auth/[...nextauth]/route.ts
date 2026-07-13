/**
 * Auth.js v5 route handler — TSK-003.
 *
 * Punto di entrata per tutte le route di autenticazione Auth.js:
 * - GET  /api/auth/session       — sessione corrente
 * - GET  /api/auth/providers     — provider disponibili
 * - GET  /api/auth/csrf          — CSRF token
 * - POST /api/auth/signin        — avvia sign-in
 * - POST /api/auth/signout       — sign-out
 * - POST /api/auth/callback/:provider — callback OAuth (non usato per Credentials)
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
