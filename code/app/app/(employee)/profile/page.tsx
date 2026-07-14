/**
 * app/(employee)/profile/page.tsx — Profilo dipendente.
 *
 * Server Component: recupera dati utente dalla sessione.
 * I form client (ProfileForm, PasswordForm) fanno fetch di /api/users/me.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ProfilePageClient } from './_components/ProfilePageClient';

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Il mio profilo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestisci le tue informazioni personali e le credenziali di accesso
        </p>
      </div>

      <ProfilePageClient />
    </div>
  );
}
