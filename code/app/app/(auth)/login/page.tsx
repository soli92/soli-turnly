/**
 * app/(auth)/login/page.tsx — Pagina di accesso Turnly.
 *
 * Server component: definisce la server action per il sign-in
 * e renderizza il form client (LoginForm).
 *
 * Sicurezza:
 * - RF-A CA1: in caso di credenziali errate, il messaggio è generico
 *   ("Credenziali non valide") — non rivela quale campo è sbagliato.
 * - RF-A CA3: sessione scaduta → il middleware redirige qui con callbackUrl.
 *
 * Redirect post-login:
 * - Il middleware intercetta gli utenti autenticati che visitano /login
 *   e li redirige al dashboard di ruolo (/admin/dashboard o /calendar).
 * - La root page '/' offre un ulteriore fallback di redirect.
 */

import type { Metadata } from 'next';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import LoginForm from './_components/login-form';

export const metadata: Metadata = {
  title: 'Accedi',
  description: 'Accedi a Turnly per gestire i tuoi turni',
};

// ----------------------------------------------------------------
// Server action — definita inline con 'use server' per Next.js 15.
// Viene passata come prop al client component LoginForm.
// ----------------------------------------------------------------

async function loginAction(_prevState: { error?: string } | null, formData: FormData) {
  'use server';

  try {
    await signIn('credentials', {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      // Redirect alla root, il middleware provvede al redirect di ruolo.
      redirectTo: '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // RF-A CA1: messaggio generico — non rivela quale campo è errato
      return { error: 'Credenziali non valide' };
    }
    // NEXT_REDIRECT non è un errore reale: re-throw per propagare il redirect
    throw error;
  }

  return null;
}

// ----------------------------------------------------------------
// Page component
// ----------------------------------------------------------------

export default function LoginPage() {
  return (
    <main
      className="bg-background flex min-h-screen items-center justify-center px-4"
      aria-label="Pagina di accesso"
    >
      <div className="border-border bg-surface w-full max-w-sm space-y-6 rounded-lg border p-8 shadow-sm">
        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="text-text text-2xl font-bold tracking-tight">Turnly</h1>
          <p className="text-muted text-sm">Accedi al tuo account</p>
        </div>

        {/* Form — client component con stato e interattività */}
        <LoginForm action={loginAction} />
      </div>
    </main>
  );
}
