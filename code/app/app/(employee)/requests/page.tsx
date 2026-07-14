/**
 * app/(employee)/requests/page.tsx — "Le mie richieste" (TSK-022).
 *
 * Server Component (RSC): verifica sessione e renderizza il client component.
 * La sicurezza IDOR è garantita server-side:
 *   - L'API GET /api/requests filtra WHERE user_id = session.user.id per i dipendenti (T-SEC-07)
 *   - Il layout (employee)/layout.tsx verifica già l'autenticazione
 *
 * RF-M: pagina principale del self-service dipendente per le richieste.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MyRequestList } from '@/components/employee/requests/MyRequestList';

export const metadata: Metadata = {
  title: 'Le mie richieste',
  description: 'Storico e stato delle tue richieste al responsabile',
};

export default async function EmployeeRequestsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Le mie richieste</h1>
          <p className="mt-1 text-sm text-gray-500">
            Storico e stato delle tue richieste al responsabile. Gli aggiornamenti arrivano in tempo
            reale.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">Nuova richiesta</Link>
        </Button>
      </div>

      {/* Lista richieste con filtri */}
      <MyRequestList />
    </div>
  );
}
