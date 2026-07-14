/**
 * app/(admin)/swap/page.tsx — Scambio turni (admin) (TSK-026).
 *
 * Server Component (RSC): verifica sessione + ruolo admin.
 * Prefetch lista utenti attivi lato server per ShiftSearchPanel.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │  Titolo + descrizione (RF-F)                           │
 *   ├────────────────────────────────────────────────────────┤
 *   │  SwapAdminPageClient                                   │
 *   │    ┌──────────────┐  ┌──────────────┐                 │
 *   │    │ Pannello A   │  │ Pannello B   │                 │
 *   │    └──────────────┘  └──────────────┘                 │
 *   │    ┌───────────────────────────────────────────┐      │
 *   │    │ SwapImpactPreview (caricamento automatico) │      │
 *   │    └───────────────────────────────────────────┘      │
 *   └────────────────────────────────────────────────────────┘
 *
 * RF-F — Scambio turni
 * RB-10 — Re-validazione dopo swap
 * ADR-001
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SwapAdminPageClient } from './_components/SwapAdminPageClient';

export const metadata: Metadata = {
  title: 'Scambio turni',
  description: 'Esegui uno scambio diretto di turni tra due dipendenti',
};

// ---------------------------------------------------------------------------
// Page (RSC)
// ---------------------------------------------------------------------------

export default async function SwapAdminPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  // Prefetch degli utenti attivi per ShiftSearchPanel
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
    <div className="space-y-6">
      {/* Intestazione */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scambio turni</h1>
        <p className="mt-1 text-sm text-gray-500">
          Seleziona due turni di dipendenti diversi per eseguire uno scambio diretto. Il sistema
          verifica automaticamente le regole di business prima di confermare.
        </p>
      </div>

      {/* Client Component — state machine selezione → anteprima → conferma */}
      <SwapAdminPageClient users={activeUsers} />
    </div>
  );
}
