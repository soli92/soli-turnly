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
import { notificationKeys } from '@/hooks/useNotificationMutations';
import type { SSEEvent } from '@/lib/sse/types';

export function useNotifications(): void {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Non aprire la connessione se non c'è sessione attiva
    if (!session?.user?.id) return;

    let currentEs: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (e: MessageEvent<string>) => {
      let event: SSEEvent;
      try {
        event = JSON.parse(e.data) as SSEEvent;
      } catch {
        return;
      }

      switch (event.type) {
        case 'shift.assigned':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          // RF-H CA2: aggiorna il monitor copertura in tempo reale
          queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
          toast.info('Nuovo turno assegnato');
          break;

        case 'shift.modified':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          // RF-H CA2: aggiorna il monitor copertura in tempo reale
          queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
          toast.info('Turno modificato');
          break;

        case 'shift.deleted':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          // RF-H CA2: aggiorna il monitor copertura in tempo reale
          queryClient.invalidateQueries({ queryKey: ['coverage-monitor'] });
          toast.info('Turno cancellato');
          break;

        case 'request.received':
          // Destinatario: admin — nuova richiesta da approvare
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          toast.info('Nuova richiesta ricevuta');
          break;

        case 'request.approved':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          toast.success('La tua richiesta è stata approvata');
          break;

        case 'request.rejected':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          toast.error('La tua richiesta è stata rifiutata');
          break;

        case 'swap.request':
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          toast.info('Richiesta di scambio turno ricevuta');
          break;

        case 'swap.accepted':
          queryClient.invalidateQueries({ queryKey: ['shifts'] });
          queryClient.invalidateQueries({ queryKey: ['requests'] });
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          toast.success('Scambio turno accettato');
          break;

        default:
          // Evento sconosciuto — invalida le notifiche come fallback
          queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
          break;
      }
    };

    const connect = () => {
      const es = new EventSource('/api/notifications/sse');
      currentEs = es;
      es.onmessage = handleMessage;
      es.onerror = () => {
        // Chiude la connessione e riapre dopo 5s (backoff fisso).
        // Se la sessione è scaduta (401), al reconnect il server restituirà
        // 401 e lo stream sarà chiuso di nuovo senza dati: comportamento corretto.
        es.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout !== null) clearTimeout(reconnectTimeout);
      currentEs?.close();
    };
  }, [session?.user?.id, queryClient]);
}
