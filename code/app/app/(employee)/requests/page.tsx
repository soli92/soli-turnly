/**
 * app/(employee)/requests/page.tsx — Lista richieste dipendente.
 *
 * Server Component: recupera le richieste dell'utente corrente.
 * Il componente lista lato client usa TanStack Query per refetch automatico.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RequestsListClient } from './_components/RequestsListClient';

export default async function EmployeeRequestsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Le mie richieste</h1>
          <p className="text-sm text-gray-500 mt-1">
            Storico e stato delle tue richieste al responsabile
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">Nuova richiesta</Link>
        </Button>
      </div>

      <RequestsListClient />
    </div>
  );
}
