/**
 * app/(admin)/requests/page.tsx — Coda approvazioni richieste (admin).
 *
 * Server Component: verifica ruolo admin (già fatto dal layout — defense in depth).
 * Il componente RequestQueue lato client usa TanStack Query + TanStack Table v8.
 *
 * Default view: richieste con status=sent (inbox pendente).
 * Filtri disponibili: stato, tipo.
 * Ogni riga include link a /requests/[id] per il dettaglio + approvazione.
 *
 * Layer: fe (TSK-020)
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { RequestQueue } from '@/components/requests/RequestQueue';

export const metadata: Metadata = {
  title: 'Coda approvazioni',
  description: 'Gestisci le richieste dei dipendenti in attesa di approvazione',
};

export default async function AdminRequestsPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coda approvazioni</h1>
        <p className="mt-1 text-sm text-gray-500">
          Approva o rifiuta le richieste dei dipendenti. Clicca su &quot;Dettaglio&quot; per
          rivedere l&apos;impatto e gestire l&apos;approvazione.
        </p>
      </div>

      <RequestQueue />
    </div>
  );
}
