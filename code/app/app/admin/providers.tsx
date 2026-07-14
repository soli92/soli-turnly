'use client';

/**
 * app/(admin)/providers.tsx — Client providers per l'area admin.
 *
 * Wrappa i children con:
 *   - SessionProvider (next-auth/react) — richiesto da useSession() e useNotifications()
 *   - QueryClientProvider (TanStack Query v5) — richiesto da tutti gli hook useXxx()
 *   - TooltipProvider — richiesto da Tooltip di shadcn/ui
 *
 * TSK-028: aggiunto SessionProvider per supportare NotificationBell (useNotifications).
 *
 * Il QueryClient è creato con useState per evitare di condividerlo
 * tra richieste diverse in SSR (best practice TanStack Query v5).
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dati considerati freschi per 1 minuto
            staleTime: 60 * 1000,
            // Retry 1 volta su errore di rete
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {/* TooltipProvider globale per ViolationBadge e altri tooltip */}
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
