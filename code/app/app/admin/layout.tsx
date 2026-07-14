/**
 * app/(admin)/layout.tsx — Layout area amministratore.
 *
 * Server component: verifica sessione Auth.js v5 e ruolo admin
 * prima di renderizzare il contenuto.
 *
 * Sicurezza:
 * - RF-A CA2: verifica session.user.role === 'admin' su ogni request
 * - Non autenticato → redirect /login
 * - Autenticato ma non admin → redirect /calendar
 *
 * Nota: il middleware RBAC esegue lo stesso controllo a livello Edge.
 * Il doppio gate (middleware + layout) garantisce protezione anche se
 * il middleware viene bypassato (defense in depth).
 *
 * TSK-028: aggiunto link "Notifiche" nel nav sidebar admin e NotificationBell
 * nell'header. Providers spostato a wrappare header + main.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { Providers } from './providers';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  // Gate 1: utente non autenticato
  if (!session) {
    redirect('/login');
  }

  // Gate 2: utente autenticato ma non admin (RF-A CA2)
  if (session.user.role !== 'admin') {
    redirect('/calendar');
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/*
        Sidebar e navigation completi in TSK-004.
        Placeholder strutturale per il layout a 2 colonne.
      */}
      <aside className="border-border bg-surface hidden w-64 shrink-0 border-r lg:block">
        <div className="flex h-full flex-col px-4 py-6">
          <span className="text-text text-lg font-bold">Turnly</span>
          <span className="text-muted mt-1 text-xs">Area Admin</span>
          {/* Navigation items: TSK-004 */}

          {/* Navigazione notifiche — TSK-028 */}
          <nav className="mt-6" aria-label="Navigazione admin">
            <Link
              href="/notifications"
              className="text-text flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-gray-100"
            >
              Notifiche
            </Link>
          </nav>
        </div>
      </aside>

      {/*
        Providers wrappa header + main in modo che NotificationBell (TSK-028)
        abbia accesso a QueryClientProvider e SessionProvider.
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
