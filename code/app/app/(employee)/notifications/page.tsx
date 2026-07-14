/**
 * app/(employee)/notifications/page.tsx — Centro notifiche (TSK-028).
 *
 * Server Component (RSC): verifica sessione e renderizza i client component.
 *
 * Accessibile sia a dipendenti sia ad admin:
 *   - Il layout (employee)/layout.tsx verifica solo l'autenticazione, non il ruolo.
 *   - Gli admin navigano a /notifications tramite il link nel nav admin.
 *
 * RF-N: screen 21 inventario — centro notifiche completo con paginazione e bulk read.
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { NotificationCenterClient } from './_components/NotificationCenterClient';
import { MarkAllReadButton } from './_components/MarkAllReadButton';

export const metadata: Metadata = {
  title: 'Centro notifiche — Turnly',
  description: 'Tutte le tue notifiche in un unico posto. Aggiornamenti in tempo reale.',
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Centro notifiche</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tutte le tue notifiche. Gli aggiornamenti arrivano in tempo reale.
          </p>
        </div>
        {/* MarkAllReadButton è un Client Component — importabile in RSC */}
        <MarkAllReadButton />
      </div>

      {/* Lista notifiche con paginazione */}
      <NotificationCenterClient />
    </div>
  );
}
