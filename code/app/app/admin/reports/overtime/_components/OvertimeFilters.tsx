'use client';

/**
 * OvertimeFilters.tsx — Filtri per il report straordinari (TSK-027).
 *
 * Contiene:
 *   - DateRangePicker (from/to) con campi input type="date"
 *   - Select dipendente (opzionale)
 *   - Pulsante "Genera report"
 *   - Pulsante "Esporta CSV" (genera file lato browser da data[])
 *
 * RF-I — selezione periodo + filtro dipendente.
 * AC: Export CSV → file report_straordinari_<from>_<to>.csv
 */

import { useId } from 'react';
import { Download, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OvertimeReportRow } from '@/hooks/useOvertimeReport';

// ---------------------------------------------------------------------------
// Tipo utente minimo per il select
// ---------------------------------------------------------------------------

export interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OvertimeFiltersProps {
  /** Valore corrente data inizio (YYYY-MM-DD) */
  from: string;
  /** Valore corrente data fine (YYYY-MM-DD) */
  to: string;
  /** Valore corrente dipendente selezionato (undefined = tutti) */
  userId: string | undefined;
  /** Lista utenti per il select */
  users: UserOption[];
  /** Errore di validazione date (da mostrare inline) */
  // NOTE: esplicito string | undefined per compatibilità con exactOptionalPropertyTypes.
  dateError?: string | undefined;
  /** Dati correnti del report (per l'export CSV) */
  // NOTE: esplicito | undefined per compatibilità con exactOptionalPropertyTypes.
  reportData?: OvertimeReportRow[] | undefined;
  /** Periodo report corrente (per il nome file CSV) */
  reportPeriod?: { from: string; to: string } | undefined;
  /** true durante il fetch */
  isLoading: boolean;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onUserIdChange: (value: string | undefined) => void;
  /** Callback per avviare la fetch (click "Genera report") */
  onSubmit: () => void;
}

// ---------------------------------------------------------------------------
// Helper: genera e scarica CSV lato browser
// ---------------------------------------------------------------------------

function exportCsv(rows: OvertimeReportRow[], from: string, to: string): void {
  const headers = [
    'Cognome',
    'Nome',
    'Qualifica',
    'Ore contratto/settimana',
    'Ore ordinarie',
    'Ore straordinarie',
    'Ore totali',
    'Sopra soglia',
  ];

  const lines = rows.map((r) =>
    [
      r.lastName,
      r.firstName,
      r.qualificationName ?? '',
      r.contractHours,
      r.ordinaryHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      r.totalHours.toFixed(2),
      r.overtimeExceedsThreshold ? 'SI' : 'NO',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report_straordinari_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function OvertimeFilters({
  from,
  to,
  userId,
  users,
  dateError,
  reportData,
  reportPeriod,
  isLoading,
  onFromChange,
  onToChange,
  onUserIdChange,
  onSubmit,
}: OvertimeFiltersProps) {
  const fromId = useId();
  const toId = useId();
  const userId2 = useId();

  const canExport = Boolean(reportData && reportData.length > 0 && reportPeriod);

  function handleExport() {
    if (!reportData || !reportPeriod) return;
    exportCsv(reportData, reportPeriod.from, reportPeriod.to);
  }

  return (
    <div
      className="flex flex-wrap items-end gap-4"
      role="group"
      aria-label="Filtri report straordinari"
    >
      {/* ---- Dal --------------------------------------------------------- */}
      <div className="space-y-1">
        <label htmlFor={fromId} className="text-xs font-medium text-gray-600">
          Dal <span aria-hidden="true">*</span>
        </label>
        <Input
          id={fromId}
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="w-36"
          aria-label="Data inizio periodo"
          aria-required="true"
          aria-invalid={Boolean(dateError)}
          aria-describedby={dateError ? 'filters-date-error' : undefined}
        />
      </div>

      {/* ---- Al ---------------------------------------------------------- */}
      <div className="space-y-1">
        <label htmlFor={toId} className="text-xs font-medium text-gray-600">
          Al <span aria-hidden="true">*</span>
        </label>
        <Input
          id={toId}
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="w-36"
          aria-label="Data fine periodo"
          aria-required="true"
          aria-invalid={Boolean(dateError)}
        />
      </div>

      {/* ---- Errore date ------------------------------------------------- */}
      {dateError && (
        <div
          id="filters-date-error"
          role="alert"
          className="flex items-center self-end pb-1 text-xs text-red-700"
        >
          {dateError}
        </div>
      )}

      {/* ---- Dipendente -------------------------------------------------- */}
      <div className="max-w-xs min-w-[180px] flex-1 space-y-1">
        <label htmlFor={userId2} className="text-xs font-medium text-gray-600">
          Dipendente
        </label>
        <Select
          value={userId ?? '__all__'}
          onValueChange={(v) => onUserIdChange(v === '__all__' ? undefined : v)}
        >
          <SelectTrigger id={userId2} aria-label="Filtra per dipendente">
            <SelectValue placeholder="Tutti i dipendenti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i dipendenti</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.lastName} {u.firstName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- Genera report ----------------------------------------------- */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isLoading || !from || !to}
        aria-label="Genera report straordinari"
        className="self-end"
      >
        <Search className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {isLoading ? 'Caricamento...' : 'Genera report'}
      </Button>

      {/* ---- Esporta CSV ------------------------------------------------- */}
      <Button
        type="button"
        variant="outline"
        onClick={handleExport}
        disabled={!canExport}
        aria-label={`Esporta report straordinari in CSV${reportPeriod ? ` dal ${reportPeriod.from} al ${reportPeriod.to}` : ''}`}
        className="self-end"
      >
        <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Esporta CSV
      </Button>
    </div>
  );
}
