'use client';

/**
 * components/matrix/ShiftCell.tsx — Cella singola della griglia turni.
 *
 * Stati:
 *   - empty:   cella vuota, cliccabile per assegnare un turno
 *   - occupied: turno presente → nome tipologia + orari
 *   - absence:  assenza approvata → badge grigio, NON cliccabile (T-DOM-04)
 *   - compact:  vista mese (cella 36px) → solo lettera iniziale + colore
 *
 * Violazioni (TSK-006 stub):
 *   - blocking: bordo rosso border-red-500 + ViolationBadge X
 *   - warning:  bordo ambra border-amber-400 + ViolationBadge ⚠
 *
 * data-testid="shift-cell-{userId}-{date}" per Playwright (TSK-010)
 */

import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViolationBadge } from './ViolationBadge';
import type { ShiftRow, AbsenceRow, RuleViolation, ShiftTypeRow } from '@/types';

interface ShiftCellProps {
  userId: string;
  date: string; // YYYY-MM-DD

  /** Turno per questa cella, null se vuota */
  shift: ShiftRow | null;

  /** Assenza che copre questa data, null se assente */
  absence: AbsenceRow | null;

  /** Tipi di turno per la ricerca del colore */
  shiftTypes: ShiftTypeRow[];

  /** Vista compatta (mese) vs espansa (settimana) */
  isCompact: boolean;

  /** Violazioni inline per questa cella */
  violations: RuleViolation[];

  /** Callback click → apre ShiftEditor */
  onCellClick: (params: { userId: string; date: string; shift: ShiftRow | null }) => void;
}

/**
 * Formatta l'orario da ISO string a HH:MM.
 */
function formatTime(isoStr: string): string {
  return format(new Date(isoStr), 'HH:mm');
}

export function ShiftCell({
  userId,
  date,
  shift,
  absence,
  isCompact,
  violations,
  onCellClick,
}: ShiftCellProps) {
  const blockingViolations = violations.filter((v) => v.severity === 'blocking');
  const warningViolations = violations.filter((v) => v.severity === 'warning');
  const hasBlocking = blockingViolations.length > 0;
  const hasWarning = warningViolations.length > 0;

  // Cella assenza — non cliccabile (T-DOM-04)
  if (absence) {
    if (isCompact) {
      return (
        <div
          className="flex h-full w-full items-center justify-center"
          aria-label={`Assenza: ${absence.absenceTypeName}`}
          aria-readonly={true}
          data-testid={`shift-cell-${userId}-${date}`}
          role="cell"
        >
          <div
            className="mx-0.5 h-5 w-full rounded-sm bg-gray-200"
            title={absence.absenceTypeName}
          />
        </div>
      );
    }
    return (
      <div
        className="flex h-full w-full items-center justify-center px-1"
        aria-label={`Assenza: ${absence.absenceTypeName}`}
        aria-readonly={true}
        data-testid={`shift-cell-${userId}-${date}`}
        role="cell"
      >
        <span className="inline-flex cursor-not-allowed items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 select-none">
          {absence.absenceTypeName}
        </span>
      </div>
    );
  }

  // Gestione click
  const handleClick = () => {
    onCellClick({ userId, date, shift });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Classi bordo violazione
  const borderClass = hasBlocking
    ? 'border-2 border-red-500'
    : hasWarning
      ? 'border-2 border-amber-400'
      : 'border border-transparent';

  // ---------------------------------------------------------------
  // Vista compatta (mese: 36px celle)
  // ---------------------------------------------------------------
  if (isCompact) {
    if (!shift) {
      return (
        <div
          role="button"
          tabIndex={0}
          className={cn(
            'flex h-full w-full cursor-pointer items-center justify-center rounded-sm',
            'hover:bg-blue-50 focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none',
            borderClass
          )}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={`Aggiungi turno per il ${date}`}
          data-testid={`shift-cell-${userId}-${date}`}
        />
      );
    }

    const bgColor = shift.shiftTypeColor ?? '#6B7280';
    const label = shift.shiftTypeCode?.[0] ?? '?';

    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'relative flex h-full w-full cursor-pointer items-center justify-center rounded-sm',
          'focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:outline-none',
          borderClass
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Turno ${shift.shiftTypeName ?? 'senza tipo'} — ${formatTime(shift.startDt)}–${formatTime(shift.endDt)}`}
        data-testid={`shift-cell-${userId}-${date}`}
      >
        <div
          className="mx-0.5 flex h-5 w-full items-center justify-center rounded-sm text-xs font-bold text-white select-none"
          style={{ backgroundColor: bgColor }}
        >
          {label}
        </div>
        {/* Badge violazione sovrapposto */}
        {(hasBlocking || hasWarning) && (
          <span className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4">
            <ViolationBadge
              violations={hasBlocking ? blockingViolations : warningViolations}
              severity={hasBlocking ? 'blocking' : 'warning'}
            />
          </span>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Vista espansa (settimana: ~120px celle)
  // ---------------------------------------------------------------
  if (!shift) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'group flex h-full min-h-[48px] w-full cursor-pointer items-center justify-center rounded-md',
          'hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
          borderClass
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`Aggiungi turno per il ${date}`}
        data-testid={`shift-cell-${userId}-${date}`}
      >
        <Plus
          className="h-4 w-4 text-gray-300 transition-colors group-hover:text-blue-400"
          aria-hidden="true"
        />
      </div>
    );
  }

  const bgColor = shift.shiftTypeColor ?? '#6B7280';

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'relative flex h-full min-h-[48px] w-full cursor-pointer flex-col items-start justify-center rounded-md px-2 py-1',
        'focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none',
        'transition-all hover:brightness-95',
        borderClass
      )}
      style={{ backgroundColor: `${bgColor}18` }} // Sfondo molto tenue del colore turno
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Turno ${shift.shiftTypeName ?? 'senza tipo'} — ${formatTime(shift.startDt)}–${formatTime(shift.endDt)}. Clicca per modificare.`}
      data-testid={`shift-cell-${userId}-${date}`}
    >
      {/* Indicatore colore + codice turno */}
      <div className="flex items-center gap-1">
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: bgColor }}
          aria-hidden="true"
        />
        <span className="truncate text-xs font-semibold text-gray-800">
          {shift.shiftTypeName ?? shift.shiftTypeCode ?? '—'}
        </span>
      </div>

      {/* Orario */}
      <span className="text-xs text-gray-500">
        {formatTime(shift.startDt)}–{formatTime(shift.endDt)}
      </span>

      {/* Badge violazione */}
      {(hasBlocking || hasWarning) && (
        <span className="absolute top-1 right-1">
          <ViolationBadge
            violations={hasBlocking ? blockingViolations : warningViolations}
            severity={hasBlocking ? 'blocking' : 'warning'}
          />
        </span>
      )}
    </div>
  );
}
