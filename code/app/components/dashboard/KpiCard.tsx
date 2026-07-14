'use client';

/**
 * components/dashboard/KpiCard.tsx — Card KPI generica (TSK-014).
 *
 * Mostra un singolo indicatore di performance operativo.
 * Gestisce i 3 stati: loading (skeleton), errore (messaggio + retry), dati.
 *
 * Props:
 *   title        — Etichetta del KPI (es. "Richieste in attesa")
 *   icon         — Icona Lucide da renderizzare nell'intestazione card
 *   iconClassName — Classi aggiuntive per l'icona (colore, dimensione)
 *   queryKey     — Chiave TanStack Query
 *   queryFn      — Funzione async che ritorna { value, suffix?, change? }
 *   refetchInterval — Intervallo refetch ms (es. 60000 per InboxBadge)
 *   href         — Se valorizzato, la card è navigabile (Link) per tab accessibility
 *   'data-testid' — Selettore Playwright opzionale
 *
 * Accessibility (WCAG 2.2 AA):
 *   - aria-busy durante il loading
 *   - aria-label descrittivo sulla card navigabile
 *   - Focus ring visibile su card con href (tabindex)
 *   - TrendingUp/Down con aria-hidden + sr-only label
 *   - Timeout >5s: mostra errore con bottone "Riprova"
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertCircle, TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface KpiQueryResult {
  value: number | string;
  /** Suffix da mostrare dopo il valore (es. "h", "%") */
  suffix?: string;
  /**
   * Variazione percentuale rispetto al periodo precedente.
   * Positivo = aumento, negativo = calo.
   */
  change?: number;
}

export interface KpiCardProps {
  title: string;
  icon: LucideIcon;
  iconClassName?: string;
  queryKey: string[];
  queryFn: (signal: AbortSignal) => Promise<KpiQueryResult>;
  refetchInterval?: number | false;
  href?: string;
  'data-testid'?: string;
}

// ---------------------------------------------------------------------------
// Helpers di rendering
// ---------------------------------------------------------------------------

function ChangeIndicator({ change }: { change: number }) {
  if (change === 0) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Minus className="h-3 w-3" aria-hidden="true" />
        <span>Invariato</span>
      </span>
    );
  }

  const isPositive = change > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-500 dark:text-red-400';

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', colorClass)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>
        <span className="sr-only">{isPositive ? 'Aumento' : 'Calo'} del </span>
        {Math.abs(change)}%
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

export function KpiCard({
  title,
  icon: Icon,
  iconClassName,
  queryKey,
  queryFn,
  refetchInterval = false,
  href,
  'data-testid': testId,
}: KpiCardProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      // Timeout esplicito: AbortController annulla la fetch dopo 5s.
      // staleTime controlla solo la cache, non la cancellazione della richiesta.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      signal.addEventListener('abort', () => controller.abort());
      return queryFn(controller.signal).finally(() => clearTimeout(timeoutId));
    },
    refetchInterval,
    staleTime: 30_000,
    retry: 1,
  });

  const cardClass = cn(
    'group relative flex flex-col gap-3 rounded-xl border border-border',
    'bg-card p-5 shadow-sm transition-shadow',
    href
      ? 'hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
      : ''
  );

  const content = (
    <>
      {/* Header: icona + titolo */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            iconClassName ?? 'bg-primary/10 text-primary'
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Corpo */}
      {isLoading && (
        <div aria-busy="true" aria-label={`Caricamento ${title}`}>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-2 h-3 w-16" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex flex-col gap-2">
          <div className="text-destructive flex items-center gap-1.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Errore nel caricamento</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refetch()}
            className="h-7 self-start px-2 text-xs"
          >
            Riprova
          </Button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          <p className="text-foreground text-3xl font-bold tracking-tight">
            {data.value}
            {data.suffix && (
              <span className="text-muted-foreground ml-1 text-lg font-medium">{data.suffix}</span>
            )}
          </p>
          {data.change !== undefined && <ChangeIndicator change={data.change} />}
        </>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cardClass}
        aria-label={`${title}${data ? `: ${data.value}${data.suffix ?? ''}` : ''}`}
        data-testid={testId}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClass} data-testid={testId}>
      {content}
    </div>
  );
}
