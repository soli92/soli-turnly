'use client';

/**
 * components/staff/StaffSearchFilters.tsx — Barra filtri per l'anagrafica dipendenti.
 *
 * Filtri:
 *   - Ricerca testo libero (nome + cognome + email)
 *   - Filtro per qualifica (select)
 *   - Filtro per stato (tutti / attivi / inattivi)
 *
 * Accessibility: WCAG 2.2 AA
 * - Label associati via aria-label / htmlFor
 * - role="toolbar" sul contenitore
 * - aria-pressed sui toggle di stato
 */

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface QualificationOption {
  id: string;
  name: string;
}

export type StatusFilter = 'all' | 'active' | 'inactive';

interface StaffSearchFiltersProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  qualificationId: string;
  qualifications: QualificationOption[];
  onQualificationChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StaffSearchFilters({
  searchText,
  onSearchChange,
  qualificationId,
  qualifications,
  onQualificationChange,
  statusFilter,
  onStatusFilterChange,
}: StaffSearchFiltersProps) {
  const hasActiveFilters =
    searchText.length > 0 || qualificationId !== 'all' || statusFilter !== 'all';

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
      role="toolbar"
      aria-label="Filtri anagrafica dipendenti"
    >
      {/* Ricerca testo */}
      <div className="relative max-w-sm min-w-[200px] flex-1">
        <Search
          className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          id="staff-search"
          type="search"
          placeholder="Cerca per nome, cognome o email…"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
          aria-label="Cerca dipendente per nome, cognome o email"
          data-testid="staff-search-input"
        />
      </div>

      {/* Filtro qualifica */}
      <div className="w-[200px]">
        <Select value={qualificationId} onValueChange={onQualificationChange}>
          <SelectTrigger aria-label="Filtra per qualifica" data-testid="staff-qualification-filter">
            <SelectValue placeholder="Tutte le qualifiche" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le qualifiche</SelectItem>
            {qualifications.map((q) => (
              <SelectItem key={q.id} value={q.id}>
                {q.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro stato */}
      <div
        className="flex overflow-hidden rounded-md border border-gray-200"
        role="group"
        aria-label="Filtra per stato dipendente"
      >
        {(['all', 'active', 'inactive'] as const).map((value) => {
          const labels: Record<StatusFilter, string> = {
            all: 'Tutti',
            active: 'Attivi',
            inactive: 'Inattivi',
          };
          const isSelected = statusFilter === value;
          return (
            <Button
              key={value}
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              className={cn('rounded-none border-0', value !== 'all' && 'border-l border-gray-200')}
              onClick={() => onStatusFilterChange(value)}
              aria-pressed={isSelected}
              data-testid={`staff-status-filter-${value}`}
            >
              {labels[value]}
            </Button>
          );
        })}
      </div>

      {/* Reset filtri */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange('');
            onQualificationChange('all');
            onStatusFilterChange('all');
          }}
          aria-label="Rimuovi tutti i filtri"
          data-testid="staff-clear-filters"
        >
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          Rimuovi filtri
        </Button>
      )}
    </div>
  );
}
