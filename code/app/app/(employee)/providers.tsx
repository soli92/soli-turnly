'use client';

/**
 * app/(employee)/providers.tsx — Client providers per l'area dipendente.
 *
 * Wrappa i children con:
 *   - QueryClientProvider (TanStack Query v5) — richiesto da tutti gli hook useXxx()
 *   - SessionProvider (next-auth/react) — richiesto da useSession() e useNotifications()
 *   - TooltipProvider — richiesto da Tooltip di shadcn/ui
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
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
