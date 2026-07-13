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
 */

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { Providers } from './providers';

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
    <div className="flex min-h-screen bg-background">
      {/*
        Sidebar e navigation completi in TSK-004.
        Placeholder strutturale per il layout a 2 colonne.
      */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="flex h-full flex-col px-4 py-6">
          <span className="text-lg font-bold text-text">Turnly</span>
          <span className="mt-1 text-xs text-muted">Area Admin</span>
          {/* Navigation items: TSK-004 */}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-border bg-surface px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">
              {session.user.firstName} {session.user.lastName}
            </span>
            <span className="text-xs text-muted">
              {session.user.role}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Providers>{children}</Providers>
        </main>
      </div>
    </div>
  );
}
