/**
 * app/admin/recurrence/[id]/edit/page.tsx — Modifica ricorrenza esistente.
 *
 * Server Component:
 *   - Verifica ruolo admin (defense-in-depth oltre al layout).
 *   - Fetch della ricorrenza tramite Drizzle; 404 se non trovata.
 *   - Delega al CSR RecurrenceEditForm per la gestione interattiva.
 *
 * Routing: /admin/recurrence/[id]/edit
 * RF-E — Gestione ricorrenze e cicli rotativi
 * Riferimento: TSK-019, ADR-001
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecurrenceEditForm } from '@/components/recurrence/RecurrenceEditForm';
import { db } from '@/db';
import { recurrences } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { RecurrenceRow } from '@/hooks/useRecurrences';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditRecurrencePage({ params }: PageProps) {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  const { id } = await params;

  // Validazione UUID minima
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) notFound();

  const recurrence = await db.query.recurrences.findFirst({
    where: eq(recurrences.id, id),
  });

  if (!recurrence) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb / navigazione indietro */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/recurrence">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Lista ricorrenze
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Modifica ricorrenza</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modifica i parametri della ricorrenza. Le modifiche si applicheranno alla generazione
          futura dei turni.
        </p>
      </div>

      <RecurrenceEditForm recurrence={recurrence as unknown as RecurrenceRow} />
    </div>
  );
}
