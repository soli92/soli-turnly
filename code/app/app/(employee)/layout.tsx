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
 */

import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';

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
    <div className="flex min-h-screen bg-background">
      {/*
        Sidebar e navigation completi in TSK-008.
        Placeholder strutturale per il layout a 2 colonne.
      */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="flex h-full flex-col px-4 py-6">
          <span className="text-lg font-bold text-text">Turnly</span>
          <span className="mt-1 text-xs text-muted">
            {session.user.firstName} {session.user.lastName}
          </span>
          {/* Navigation items: TSK-008 */}
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
          {children}
        </main>
      </div>
    </div>
  );
}
