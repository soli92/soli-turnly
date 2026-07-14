'use client';

/**
 * app/(employee)/availability/_components/AvailabilityList.tsx (TSK-025)
 *
 * Lista delle voci di disponibilità con stati loading / errore / vuoto.
 * Ogni voce è renderizzata da AvailabilityCard.
 */

import { useAvailability } from '@/hooks/useAvailability';
import { AvailabilityCard } from './AvailabilityCard';

export function AvailabilityList() {
  const { data: rows, isLoading, isError, error } = useAvailability();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento disponibilità">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border-border h-20 animate-pulse rounded-lg border bg-gray-50" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento disponibilità:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">Nessuna disponibilità dichiarata</p>
        <p className="mt-1 text-xs text-gray-400">
          Usa il form qui sopra per aggiungere la tua prima finestra di disponibilità
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label="Lista disponibilità dichiarate">
      {rows.map((row) => (
        <AvailabilityCard key={row.id} row={row} />
      ))}
    </div>
  );
}
