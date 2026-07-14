/**
 * app/(admin)/requests/[id]/page.tsx — Dettaglio richiesta + pannello approvazione.
 *
 * Server Component:
 *   - Verifica sessione + ruolo admin (defense-in-depth oltre al layout).
 *   - Delega al CSR RequestDetailClient per la gestione interattiva.
 *
 * Routing: /requests/[id]
 * Layer: fe (TSK-020)
 */

import type { Metadata } from 'next';
import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { RequestDetailClient } from './_components/RequestDetailClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: 'Dettaglio richiesta',
  description: 'Revisiona e gestisci la richiesta del dipendente',
};

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const session = await auth();

  // Gate 1: utente non autenticato
  if (!session) redirect('/login');

  // Gate 2: solo admin (T-SEC-05 — defense in depth oltre al layout)
  if (session.user.role !== 'admin') redirect('/calendar');

  const { id } = await params;

  // Validazione UUID minima — Next.js restituisce la pagina not-found
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  return <RequestDetailClient requestId={id} />;
}
