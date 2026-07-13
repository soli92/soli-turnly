/**
 * app/page.tsx — Root page con redirect di ruolo.
 *
 * Server component: dopo il login, Auth.js redirige a '/' (root).
 * Questo page legge la sessione e redirige al dashboard appropriato:
 * - admin → /admin/dashboard
 * - employee (o altro) → /calendar
 * - non autenticato → /login
 *
 * Nota: il middleware RBAC gestisce la stessa logica per le route
 * /login → dashboard. Questo page copre il caso post-signIn redirect.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role === 'admin') {
    redirect('/admin/dashboard');
  }

  redirect('/calendar');
}
