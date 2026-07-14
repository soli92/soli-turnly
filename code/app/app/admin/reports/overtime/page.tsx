/**
 * app/(admin)/reports/overtime/page.tsx — Report straordinari admin (TSK-027).
 *
 * RSC: verifica sessione + ruolo admin, prefetch utenti attivi.
 * Renderizza OvertimeReportClient (Client Component).
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  Titolo + descrizione                    │
 *   ├─────────────────────────────────────────┤
 *   │  OvertimeReportClient                   │
 *   │    ├ OvertimeFilters (from/to/user/CSV) │
 *   │    └ OvertimeTable (TanStack Table v8)  │
 *   └─────────────────────────────────────────┘
 *
 * RF-I — Report ore straordinarie (screen 12 inventario).
 * RB-06 — maxStraordinarioMensileOre = 40h.
 * ADR-001.
 */

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { OvertimeReportClient } from './_components/OvertimeReportClient';

export default async function OvertimeReportPage() {
  const session = await auth();
  if (!session || session.user.role !== 'admin') redirect('/login');

  // Prefetch utenti attivi per il Select filtro dipendente
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
        <h1 className="text-2xl font-bold text-gray-900">Report straordinari</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visualizza le ore ordinarie e straordinarie per dipendente in un periodo. Le righe
          evidenziate in rosso superano il limite mensile di 40h di straordinario (RB-06).
        </p>
      </div>

      {/* Client Component: filtri + tabella */}
      <OvertimeReportClient users={activeUsers} />
    </div>
  );
}
