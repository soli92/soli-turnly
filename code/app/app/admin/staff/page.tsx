/**
 * app/(admin)/staff/page.tsx — Anagrafica dipendenti (RSC).
 *
 * Server Component:
 *   - Verifica ruolo admin (doppio gate: middleware + layout + page)
 *   - Fetcha dipendenti con qualificationName join da DB (Drizzle)
 *   - Fetcha lista qualifiche per i filtri e il modale
 *   - Passa i dati come initialData al client component StaffPageClient
 *
 * Le mutazioni (create/edit) avvengono lato client via TanStack Query
 * consumando i Route Handler esistenti:
 *   POST  /api/admin/users
 *   PATCH /api/admin/users/{id}
 *
 * TSK-016 — RF-B (anagrafica dipendenti)
 */

import type { Metadata } from 'next';
import { db } from '@/db';
import { users, qualifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { StaffPageClient } from './_components/StaffPageClient';
import type { StaffRow } from '@/hooks/useStaff';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Anagrafica dipendenti | Turnly Admin',
  description: 'Gestione dipendenti: crea, modifica e disattiva profili.',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StaffPage() {
  // Gate admin (RF-A CA2) — ridondante con layout ma defense in depth
  await requireAdmin();

  // -----------------------------------------------------------------------
  // Query parallele
  // -----------------------------------------------------------------------

  const [staffRows, qualificationsRows] = await Promise.all([
    // 1. Dipendenti con qualificationName join
    db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        qualificationId: users.qualificationId,
        qualificationName: qualifications.name,
        contractHours: users.contractHours,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(qualifications, eq(users.qualificationId, qualifications.id))
      .orderBy(users.lastName, users.firstName),

    // 2. Lista qualifiche per i filtri e il modale
    db
      .select({ id: qualifications.id, name: qualifications.name })
      .from(qualifications)
      .orderBy(qualifications.name),
  ]);

  // Serializza Date → ISO string per Client Component
  const initialStaff: StaffRow[] = staffRows.map((row) => ({
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    qualificationId: row.qualificationId ?? null,
    qualificationName: row.qualificationName ?? null,
    contractHours: row.contractHours,
    active: row.active,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }));

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Anagrafica dipendenti</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestisci i profili dei dipendenti: crea, modifica e disattiva.
        </p>
      </div>

      <StaffPageClient initialStaff={initialStaff} qualifications={qualificationsRows} />
    </div>
  );
}
