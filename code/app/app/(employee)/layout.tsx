/**
 * app/(employee)/layout.tsx — Layout area dipendente.
 *
 * Server component: verifica sessione Auth.js v5 prima di
 * renderizzare il contenuto.
 *
 * Sicurezza:
 * - RF-A CA2: verifica autenticazione su ogni request
 * - Non autenticato → redirect /login
 * - Nota: sia admin che employee possono accedere all'area dipendente
 *   (l'admin può visualizzare il proprio calendario e gestire le richieste)
 * - IDOR: le query Drizzle filtrano WHERE user_id = session.user.id (TSK-005+)
 *
 * Nota: il middleware RBAC esegue lo stesso controllo a livello Edge.
 * Il doppio gate garantisce protezione (defense in depth).
 *
 * TSK-028: Providers è stato spostato a wrappare l'intera area interna
 * (header + main) in modo che NotificationBell (Client Component) abbia
 * accesso a QueryClient e SessionProvider.
 */

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { Providers } from './providers';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface EmployeeLayoutProps {
  children: ReactNode;
}

export default async function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const session = await auth();

  // Gate: utente non autenticato
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/*
        Sidebar e navigation completi in TSK-008.
        Placeholder strutturale per il layout a 2 colonne.
      */}
      <aside className="border-border bg-surface hidden w-64 shrink-0 border-r lg:block">
        <div className="flex h-full flex-col px-4 py-6">
          <span className="text-text text-lg font-bold">Turnly</span>
          <span className="text-muted mt-1 text-xs">
            {session.user.firstName} {session.user.lastName}
          </span>
          {/* Navigation items: TSK-008 */}
        </div>
      </aside>

      {/*
        Providers wrappa header + main in modo che NotificationBell (TSK-028)
        abbia accesso a QueryClientProvider e SessionProvider.
        I children (RSC) vengono passati come slot e rimangono server-rendered.
      */}
      <Providers>
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="border-border bg-surface border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-text text-sm font-medium">
                {session.user.firstName} {session.user.lastName}
              </span>
              <div className="flex items-center gap-3">
                {/* Campanella notifiche — TSK-028 */}
                <NotificationBell />
                <span className="text-muted text-xs">{session.user.role}</span>
              </div>
            </div>
          </header>

          <main id="main-content" className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </Providers>
    </div>
  );
}
