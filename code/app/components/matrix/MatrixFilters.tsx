'use client';

/**
 * components/matrix/MatrixFilters.tsx — Barra filtri sopra la griglia turni.
 *
 * Contiene:
 *   - Search dipendente (filtra righe in tempo reale)
 *   - Select qualifica (filtra righe)
 *   - Toggle vista settimana / mese
 *   - WeekNavigator (frecce navigazione)
 *
 * Accessibility: WCAG 2.2 AA
 * - Label associati a input via htmlFor / aria-label
 * - aria-pressed sui toggle button
 */

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { WeekNavigator } from './WeekNavigator';

export type ViewMode = 'week' | 'month';

interface QualificationOption {
  id: string;
  name: string;
}

interface MatrixFiltersProps {
  /** Valore ricerca testo libero */
  searchValue: string;
  onSearchChange: (value: string) => void;

  /** Qualifica selezionata (id | 'all') */
  selectedQualification: string;
  qualifications: QualificationOption[];
  onQualificationChange: (value: string) => void;

  /** Vista corrente */
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  /** Navigazione settimana/mese */
  currentDate: Date;
  onNavigate: (newDate: Date) => void;
}

export function MatrixFilters({
  searchValue,
  onSearchChange,
  selectedQualification,
  qualifications,
  onQualificationChange,
  viewMode,
  onViewModeChange,
  currentDate,
  onNavigate,
}: MatrixFiltersProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
      role="toolbar"
      aria-label="Filtri griglia turni"
    >
      {/* Search dipendente */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search
          className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <Input
          id="matrix-search"
          type="search"
          placeholder="Cerca dipendente…"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
          aria-label="Cerca dipendente per nome"
          data-testid="matrix-search-input"
        />
      </div>

      {/* Filtro qualifica */}
      <div className="w-[180px]">
        <Select
          value={selectedQualification}
          onValueChange={onQualificationChange}
        >
          <SelectTrigger
            aria-label="Filtra per qualifica"
            data-testid="matrix-qualification-filter"
          >
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Toggle settimana / mese */}
      <div
        className="flex rounded-md border border-gray-200 overflow-hidden"
        role="group"
        aria-label="Seleziona vista"
      >
        <Button
          variant={viewMode === 'week' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-0"
          onClick={() => onViewModeChange('week')}
          aria-pressed={viewMode === 'week'}
          data-testid="matrix-view-week"
        >
          Settimana
        </Button>
        <Button
          variant={viewMode === 'month' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-0 border-l border-gray-200"
          onClick={() => onViewModeChange('month')}
          aria-pressed={viewMode === 'month'}
          data-testid="matrix-view-month"
        >
          Mese
        </Button>
      </div>

      {/* Navigazione settimana/mese */}
      <WeekNavigator
        currentDate={currentDate}
        viewMode={viewMode}
        onNavigate={onNavigate}
      />
    </div>
  );
}
