'use client';

/**
 * OvertimeReportClient.tsx — Shell client per il report straordinari (TSK-027).
 *
 * Orchestra:
 *   - OvertimeFilters: selezione periodo + dipendente + export CSV
 *   - OvertimeTable: tabella TanStack Table v8 ordinabile
 *
 * Gestione stati:
 *   - Skeleton durante il fetch (aria-busy, nessun layout shift)
 *   - Empty state "Nessun dato" se data=[]
 *   - Errore con alert
 *   - Stato iniziale: nessun report caricato ancora
 *
 * RF-I — Report straordinari.
 * AC: Skeleton + scroll orizzontale su mobile + CSV export.
 */

import { useState, useCallback } from 'react';

import { OvertimeFilters } from './OvertimeFilters';
import { OvertimeTable } from './OvertimeTable';
import { useOvertimeReport } from '@/hooks/useOvertimeReport';
import type { UserOption } from './OvertimeFilters';

// ---------------------------------------------------------------------------
// Stato dei filtri
// ---------------------------------------------------------------------------

interface FilterState {
  from: string;
  to: string;
  userId: string | undefined;
}

// ---------------------------------------------------------------------------
// Helper: default period (mese corrente)
// ---------------------------------------------------------------------------

function currentMonthDefaults(): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return {
    from: `${y}-${m}-01`,
    to: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OvertimeReportClientProps {
  users: UserOption[];
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function OvertimeReportClient({ users }: OvertimeReportClientProps) {
  const defaults = currentMonthDefaults();

  // Filtri "pending" — quello che l'utente sta modificando nel form
  const [pendingFilters, setPendingFilters] = useState<FilterState>({
    from: defaults.from,
    to: defaults.to,
    userId: undefined,
  });

  // Filtri "attivi" — quelli usati nell'ultima query avviata
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);

  // Errore di validazione locale
  const [dateError, setDateError] = useState<string | undefined>();

  // ---------------------------------------------------------------------------
  // Query TanStack
  // ---------------------------------------------------------------------------

  const { data, isLoading, isError, error } = useOvertimeReport(
    {
      from: activeFilters?.from ?? '',
      to: activeFilters?.to ?? '',
      userId: activeFilters?.userId,
    },
    { enabled: activeFilters !== null }
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(() => {
    setDateError(undefined);

    const { from, to } = pendingFilters;

    if (!from || !to) {
      setDateError('Seleziona un intervallo di date per generare il report.');
      return;
    }

    if (from >= to) {
      setDateError('La data "Dal" deve precedere la data "Al".');
      return;
    }

    setActiveFilters({ ...pendingFilters });
  }, [pendingFilters]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Filtri */}
      <section
        aria-labelledby="filters-heading"
        className="border-border rounded-lg border bg-white p-6 shadow-sm"
      >
        <h2 id="filters-heading" className="mb-4 text-base font-semibold text-gray-900">
          Filtri report
        </h2>
        <OvertimeFilters
          from={pendingFilters.from}
          to={pendingFilters.to}
          userId={pendingFilters.userId}
          users={users}
          dateError={dateError}
          reportData={data?.data}
          reportPeriod={data?.period}
          isLoading={isLoading}
          onFromChange={(v) => setPendingFilters((f) => ({ ...f, from: v }))}
          onToChange={(v) => setPendingFilters((f) => ({ ...f, to: v }))}
          onUserIdChange={(v) => setPendingFilters((f) => ({ ...f, userId: v }))}
          onSubmit={handleSubmit}
        />
      </section>

      {/* Risultati */}
      <section aria-labelledby="results-heading">
        <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="results-heading" className="text-base font-semibold text-gray-900">
              Risultati
              {data && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  — {data.data.length} dipendent{data.data.length !== 1 ? 'i' : 'e'} dal{' '}
                  {data.period.from} al {data.period.to}
                </span>
              )}
            </h2>
            {data && (
              <time
                dateTime={data.generatedAt}
                className="text-xs text-gray-400"
                title="Generato il"
              >
                Generato alle{' '}
                {new Date(data.generatedAt).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            )}
          </div>

          {/* Stato: caricamento */}
          {isLoading && (
            <div
              className="space-y-2"
              aria-busy="true"
              aria-label="Caricamento report straordinari"
            >
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="border-border h-12 animate-pulse rounded border bg-gray-50"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}

          {/* Stato: errore */}
          {isError && !isLoading && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Errore nel caricamento del report</p>
              <p className="mt-1 text-xs text-red-700">
                {error instanceof Error ? error.message : 'Errore sconosciuto'}
              </p>
            </div>
          )}

          {/* Stato: iniziale — nessuna query ancora avviata */}
          {!activeFilters && !isLoading && (
            <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
              <p className="text-sm font-medium text-gray-700">
                Seleziona un periodo e clicca &quot;Genera report&quot;
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Il report mostrerà le ore ordinarie e straordinarie per ogni dipendente.
              </p>
            </div>
          )}

          {/* Stato: dati disponibili */}
          {data && !isLoading && !isError && <OvertimeTable rows={data.data} />}
        </div>
      </section>
    </div>
  );
}
