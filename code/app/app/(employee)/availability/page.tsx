/**
 * app/(employee)/availability/page.tsx — Disponibilità e preferenze dipendente (TSK-025).
 *
 * Server Component: verifica sessione e renderizza il client component.
 * Il fetch dei dati di disponibilità è gestito da TanStack Query in AvailabilityPageClient.
 *
 * RF-L (screen 17): un dipendente inserisce/modifica/elimina finestre di
 * disponibilità (available/unavailable/preference) ricorrenti o su date specifiche.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AvailabilityPageClient } from './_components/AvailabilityPageClient';

export default async function AvailabilityPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disponibilità e preferenze</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestisci le tue finestre di disponibilità e indisponibilità per i turni
        </p>
      </div>

      <AvailabilityPageClient />
    </div>
  );
}
