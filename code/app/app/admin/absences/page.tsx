/**
 * app/(admin)/absences/page.tsx — Gestione assenze admin (TSK-017).
 *
 * Server Component (RSC): verifica sessione + ruolo admin.
 * Prefetch lista utenti lato server per evitare waterfall.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │  Titolo + descrizione            │
 *   ├──────────────────────────────────┤
 *   │  AbsenceForm (registra assenza)  │
 *   ├──────────────────────────────────┤
 *   │  AbsenceTable (lista filtrabile) │
 *   └──────────────────────────────────┘
 *
 * RF-G — Gestione assenze
 * F4   — Flusso registrazione con conflict resolution
 * ADR-001, RB-08
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AbsencesPageClient } from './_components/AbsencesPageClient';

// ---------------------------------------------------------------------------
// Page (RSC)
// ---------------------------------------------------------------------------

export default async function AbsencesPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  // Prefetch degli utenti attivi per il Select (dipendente) e per la tabella
  const activeUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.lastName, users.firstName);

  return (
    <div className="space-y-8">
      {/* Intestazione */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestione assenze</h1>
        <p className="mt-1 text-sm text-gray-500">
          Registra ferie, malattie e permessi per i dipendenti. I turni in conflitto vengono
          rilevati automaticamente prima del salvataggio.
        </p>
      </div>

      {/* Client Component che gestisce form + tabella */}
      <AbsencesPageClient users={activeUsers} />
    </div>
  );
}
