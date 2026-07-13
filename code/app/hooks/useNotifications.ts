'use client';

/**
 * hooks/useNotifications.ts — Hook SSE per notifiche real-time (TSK-008).
 *
 * Apre una connessione EventSource verso /api/notifications/sse.
 * A ogni evento ricevuto:
 *   1. Invalida le query TanStack Query pertinenti (forza refetch).
 *   2. Mostra un toast informativo (tramite lib/toast stub).
 *
 * La connessione SSE viene chiusa automaticamente:
 *   - Al logout (session diventa null)
 *   - All'unmount del componente
 *   - In caso di errore (EventSource gestisce il reconnect automaticamente;
 *     qui si chiude per evitare loop infiniti su 401)
 *
 * Utilizzo:
 *   // In un componente client radice (es. layout o navbar)
 *   useNotifications();
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import type { SSEEvent } from '@/lib/sse/types';

export function useNotifications(): void {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Non aprire la connessione se non c'è sessione attiva
    if (!session?.user?.id) return;

    const es = new EventSource('/api/notifications/sse');

    es.onmessage = (e: MessageEvent<string>) => {
      let event: SSEEvent;
      try {
        event = JSON.parse(e.data) as SSEEvent;
      } catch {
        return;
      }

      switch (event.type) {
        case 'shift.assigned':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info('Nuovo turno assegnato');
          break;

        case 'shift.modified':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info('Turno modificato');
          break;

        case 'shift.deleted':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info('Turno cancellato');
          break;

        case 'request.received':
          // Destinatario: admin — nuova richiesta da approvare
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info('Nuova richiesta ricevuta');
          break;

        case 'request.approved':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.success('La tua richiesta è stata approvata');
          break;

        case 'request.rejected':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.error('La tua richiesta è stata rifiutata');
          break;

        case 'swap.request':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.info('Richiesta di scambio turno ricevuta');
          break;

        case 'swap.accepted':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          toast.success('Scambio turno accettato');
          break;

        default:
          // Evento sconosciuto — invalida le notifiche come fallback
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
      }
    };

    es.onerror = () => {
      // Chiude la connessione in caso di errore (es. 401 dopo scadenza sessione).
      // Il browser riapre automaticamente EventSource dopo un backoff;
      // chiudere esplicitamente evita loop su sessione scaduta.
      es.close();
    };

    return () => {
      es.close();
    };
  }, [session?.user?.id, queryClient]);
}
