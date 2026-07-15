/**
 * app/(admin)/coverage/page.tsx — Gestione fabbisogni e monitor copertura (TSK-018).
 *
 * Server Component (RSC):
 *   - Verifica ruolo admin (defense in depth, doppio gate con layout)
 *   - Fetcha qualifiche e tipologie turno per i form (server-side, no waterfall)
 *   - Passa i dati al CoveragePageClient
 *
 * Due tab:
 *   - Setup fabbisogni: CoverageRuleTable + CoverageRuleModal
 *   - Monitor copertura: CoverageMonitorGrid (aggiornamento live via SSE)
 *
 * RF-H — Fabbisogni copertura, RB-07.
 * Riferimento: TSK-018, ADR-001.
 */

import type { Metadata } from 'next';
import { db } from '@/db';
import { qualifications, shiftTypes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { CoveragePageClient } from './_components/CoveragePageClient';

// Force dynamic rendering — page uses auth() (cookies) and DB queries at request time.
// Without this, Next.js production build may pre-render a redirect shell (blank page).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Fabbisogni e copertura | Turnly Admin',
  description: 'Setup fabbisogni minimi per fascia oraria/qualifica e monitor sotto-copertura.',
};

export default async function CoveragePage() {
  await requireAdmin();

  const [qualificationsRows, shiftTypesRows] = await Promise.all([
    db
      .select({ id: qualifications.id, name: qualifications.name })
      .from(qualifications)
      .orderBy(qualifications.name),
    db
      .select({ id: shiftTypes.id, name: shiftTypes.name, code: shiftTypes.code })
      .from(shiftTypes)
      .where(eq(shiftTypes.active, true))
      .orderBy(shiftTypes.name),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fabbisogni e copertura</h1>
        <p className="mt-1 text-sm text-gray-500">
          Definisci i minimi di personale per qualifica/fascia e monitora le sotto-coperture.
        </p>
      </div>

      <CoveragePageClient qualifications={qualificationsRows} shiftTypes={shiftTypesRows} />
    </div>
  );
}
