'use client';

/**
 * app/(employee)/requests/new/page.tsx — Nuova richiesta dipendente.
 *
 * Client Component: usa RequestForm multi-step.
 * Redirect a /requests dopo invio riuscito.
 */

import { useRouter } from 'next/navigation';
import { RequestForm } from '@/components/requests/RequestForm';

export default function NewRequestPage() {
  const router = useRouter();

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuova richiesta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compila il modulo per inviare una richiesta al tuo responsabile
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-6">
        <RequestForm
          onSuccess={() => router.push('/requests')}
          onCancel={() => router.push('/requests')}
        />
      </div>
    </div>
  );
}
