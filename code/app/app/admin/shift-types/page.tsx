/**
 * app/(admin)/shift-types/page.tsx — Gestione tipologie di turno (admin).
 *
 * Server Component: verifica ruolo admin (doppio gate: layout + page).
 * Il fetch della lista e le mutazioni sono gestiti lato client via TanStack Query.
 *
 * RF-C — Gestione tipologie di turno
 * Riferimento: TSK-015, ADR-001, requisiti-funzionali RF-C
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ShiftTypesClient } from './_components/ShiftTypesClient';

export default async function ShiftTypesPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tipologie di turno</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea e gestisci le tipologie di turno (mattina, pomeriggio, notte…)
        </p>
      </div>

      <ShiftTypesClient />
    </div>
  );
}
