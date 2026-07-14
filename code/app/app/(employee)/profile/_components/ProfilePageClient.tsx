'use client';

/**
 * app/(employee)/profile/_components/ProfilePageClient.tsx
 *
 * Client component che compone ProfileForm + PasswordForm.
 * Recupera /api/users/me con TanStack Query.
 */

import { ProfileForm } from '@/components/profile/ProfileForm';
import { PasswordForm } from '@/components/profile/PasswordForm';
import { useMe } from '@/hooks/useUsers';

export function ProfilePageClient() {
  const { data: user, isLoading, isError, error } = useMe();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="border-border h-32 animate-pulse rounded-lg border bg-gray-50" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento profilo:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sezione dati personali */}
      <section aria-labelledby="profile-section-heading">
        <div className="border-border rounded-lg border bg-white p-6">
          <h2 id="profile-section-heading" className="mb-4 text-base font-semibold text-gray-900">
            Dati personali
          </h2>
          <ProfileForm user={user} />
        </div>
      </section>

      {/* Sezione sicurezza */}
      <section aria-labelledby="security-section-heading">
        <div className="border-border rounded-lg border bg-white p-6">
          <h2 id="security-section-heading" className="mb-4 text-base font-semibold text-gray-900">
            Sicurezza
          </h2>
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
