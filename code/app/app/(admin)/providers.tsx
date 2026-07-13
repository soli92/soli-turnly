'use client';

/**
 * app/(admin)/providers.tsx — Client providers per l'area admin.
 *
 * Wrappa i children con QueryClientProvider (TanStack Query v5).
 * Istanziato una sola volta per l'intero subtree admin.
 *
 * Il QueryClient è creato con useState per evitare di condividerlo
 * tra richieste diverse in SSR (best practice TanStack Query v5).
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* TooltipProvider globale per ViolationBadge e altri tooltip */}
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
