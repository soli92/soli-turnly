/**
 * app/(admin)/users/page.tsx — Lista utenti (admin).
 *
 * Server Component: verifica ruolo admin.
 * La lista utenti lato client usa TanStack Query.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UsersListClient } from './_components/UsersListClient';

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione dipendenti</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crea, modifica e gestisci i profili dei dipendenti
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">Nuovo dipendente</Link>
        </Button>
      </div>

      <UsersListClient />
    </div>
  );
}
