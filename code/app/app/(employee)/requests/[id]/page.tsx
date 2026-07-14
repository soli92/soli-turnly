/**
 * app/(employee)/requests/[id]/page.tsx — Dettaglio richiesta dipendente (TSK-022).
 *
 * Server Component (RSC): verifica sessione e pre-fetcha la richiesta.
 * Sicurezza IDOR: GET /api/requests/:id verifica che session.user.id === request.userId
 * (oppure ruolo admin) prima di rispondere. Se l'utente non è il proprietario → 403.
 *
 * Il client component gestisce:
 *   - Cronologia stati (RequestTimeline)
 *   - Annullamento se stato lo consente (RequestCancelButton)
 *   - Accetta/rifiuta scambio se è il destinatario (SwapAcceptRejectPanel)
 *   - Aggiornamento real-time via SSE (useNotifications nel layout)
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { RequestDetailClient } from './_components/RequestDetailClient';

interface RequestDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Dettaglio richiesta',
};

export default async function RequestDetailPage({ params }: RequestDetailPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;

  // Validazione formato UUID minimale — evita richieste inutili al DB
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <RequestDetailClient id={id} />
    </div>
  );
}
