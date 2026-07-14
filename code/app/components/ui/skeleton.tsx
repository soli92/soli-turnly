/**
 * components/ui/skeleton.tsx — Skeleton loading placeholder (shadcn/ui pattern).
 *
 * Usato durante il fetch dei KPI dashboard e di altri contenuti asincroni.
 * Usa l'animazione `animate-pulse` di Tailwind con il colore `bg-muted`.
 *
 * Accessibility: aria-hidden="true" perché è pura decorazione visiva;
 * i componenti padre forniscono l'alternativa testuale via aria-busy o aria-label.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
