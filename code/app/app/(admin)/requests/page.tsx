/**
 * app/(admin)/requests/page.tsx — Coda approvazioni richieste (admin).
 *
 * Server Component: verifica ruolo admin (già fatto dal layout).
 * Il componente coda lato client usa TanStack Query.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ApprovalQueueClient } from './_components/ApprovalQueueClient';

export default async function AdminRequestsPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coda approvazioni</h1>
        <p className="text-sm text-gray-500 mt-1">
          Approva o rifiuta le richieste dei dipendenti
        </p>
      </div>

      <ApprovalQueueClient />
    </div>
  );
}
