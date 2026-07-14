'use client';

/**
 * app/(admin)/users/new/page.tsx — Crea nuovo dipendente.
 *
 * Client Component: usa UserForm in modalità "create".
 * Redirect alla lista utenti dopo la creazione.
 */

import { useRouter } from 'next/navigation';
import { UserForm } from '@/components/admin/UserForm';

export default function NewUserPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuovo dipendente</h1>
        <p className="mt-1 text-sm text-gray-500">Crea un nuovo profilo dipendente</p>
      </div>

      <div className="border-border rounded-lg border bg-white p-6">
        <UserForm
          mode="create"
          onSuccess={() => router.push('/admin/users')}
          onCancel={() => router.push('/admin/users')}
        />
      </div>
    </div>
  );
}
