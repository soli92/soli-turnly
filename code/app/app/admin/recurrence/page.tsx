/**
 * app/(admin)/recurrence/page.tsx — Lista ricorrenze attive (admin).
 *
 * Server Component: verifica ruolo admin (doppio gate: layout + page).
 * Il fetch della lista e le mutazioni sono gestiti lato client via TanStack Query.
 *
 * RF-E — Gestione ricorrenze e cicli rotativi
 * Riferimento: TSK-019, ADR-001, requisiti-funzionali RF-E
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RecurrenceList } from '@/components/recurrence/RecurrenceList';

export default async function RecurrencePage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ricorrenze e cicli</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestisci le regole di ricorrenza per la generazione automatica dei turni (RF-E).
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/recurrence/new">Nuova ricorrenza</Link>
        </Button>
      </div>

      <RecurrenceList />
    </div>
  );
}
