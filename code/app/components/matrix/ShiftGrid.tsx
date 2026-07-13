'use client';

/**
 * components/matrix/ShiftGrid.tsx — Griglia turni dipendenti × giorni.
 *
 * TanStack Table v8 + @tanstack/react-virtual (righe).
 *
 * Layout:
 *   - Colonna "employee" sticky a sinistra (column pinning)
 *   - Header giorni sticky in alto
 *   - Virtualizzazione righe (50+ dipendenti senza blocco UI)
 *   - Toggle vista settimana (7 giorni) / mese (28-31 giorni)
 *
 * Props:
 *   employees        - Lista dipendenti (dal server)
 *   shifts           - Turni del periodo (inizialmente dal server, poi TanStack Query)
 *   absences         - Assenze del periodo
 *   shiftTypes       - Tipi turno per dropdown ShiftEditor
 *   initialWeek      - Settimana iniziale (es. "2024-W28") per TanStack Query
 *   qualifications   - Qualifiche per il filtro
 *
 * Performance target:
 *   - 50 dipendenti × 31 giorni carica in < 2s (T-RNF-01)
 *   - Scroll fluido orizzontale + verticale
 *
 * Accessibility: WCAG 2.2 AA
 *   - role="grid" sull'elemento tabella
 *   - role="row" / role="columnheader" / role="gridcell" sugli elementi
 *   - aria-colindex, aria-rowindex
 */

import { useState, useRef, useMemo, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type ColumnPinningState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  format,
  eachDayOfInterval,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';
import { it } from 'date-fns/locale';

import { useShifts, useShiftsByMonth } from '@/hooks/useShifts';
import { ShiftCell } from './ShiftCell';
import { ShiftEditor } from './ShiftEditor';
import { MatrixFilters, type ViewMode } from './MatrixFilters';

import type {
  EmployeeRow,
  ShiftRow,
  AbsenceRow,
  ShiftTypeRow,
  RuleViolation,
} from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QualificationOption {
  id: string;
  name: string;
}

interface ShiftEditorState {
  open: boolean;
  userId: string;
  date: string;
  shift: ShiftRow | null;
}

interface ShiftGridProps {
  employees: EmployeeRow[];
  initialShifts: ShiftRow[];
  absences: AbsenceRow[];
  shiftTypes: ShiftTypeRow[];
  initialWeek: string; // YYYY-Www
  qualifications: QualificationOption[];
}

// ---------------------------------------------------------------------------
// Parse ISO week param ("2024-W28") → Date (Monday of that week)
// ---------------------------------------------------------------------------

function parseISOWeekParam(weekStr: string): Date {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return startOfISOWeek(new Date());
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  return addDays(startOfISOWeek(jan4), (week - 1) * 7);
}

/**
 * Genera la chiave ISO week "YYYY-Www" da una data.
 * Usa getISOWeekYear e getISOWeek per evitare ambiguità nei format tokens.
 */
function toISOWeekKey(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Column size
// ---------------------------------------------------------------------------

const EMPLOYEE_COL_WIDTH = 180;
const WEEK_DAY_COL_WIDTH = 120;
const MONTH_DAY_COL_WIDTH = 40;
const ROW_HEIGHT = 56; // px

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShiftGrid({
  employees,
  initialShifts,
  absences,
  shiftTypes,
  initialWeek,
  qualifications,
}: ShiftGridProps) {
  // -----------------------------------------------------------------------
  // Navigation state
  // -----------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(
    () => parseISOWeekParam(initialWeek),
  );

  // -----------------------------------------------------------------------
  // Compute period range + TanStack Query
  // -----------------------------------------------------------------------
  const periodRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        start: startOfISOWeek(currentDate),
        end: endOfISOWeek(currentDate),
        days: eachDayOfInterval({
          start: startOfISOWeek(currentDate),
          end: endOfISOWeek(currentDate),
        }),
      };
    }
    return {
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
      days: eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate),
      }),
    };
  }, [currentDate, viewMode]);

  const currentWeekKey = toISOWeekKey(currentDate);
  const currentMonthKey = format(currentDate, 'yyyy-MM');

  const weekQuery = useShifts(currentWeekKey, {
    initialData: viewMode === 'week' && currentWeekKey === initialWeek
      ? initialShifts
      : undefined,
    enabled: viewMode === 'week',
  });

  const monthQuery = useShiftsByMonth(currentMonthKey, {
    enabled: viewMode === 'month',
  });

  const shifts: ShiftRow[] =
    viewMode === 'week'
      ? (weekQuery.data ?? initialShifts)
      : (monthQuery.data ?? []);

  // -----------------------------------------------------------------------
  // Filter state
  // -----------------------------------------------------------------------
  const [searchValue, setSearchValue] = useState('');
  const [selectedQualification, setSelectedQualification] = useState('all');

  // -----------------------------------------------------------------------
  // ShiftEditor state
  // -----------------------------------------------------------------------
  const [editorState, setEditorState] = useState<ShiftEditorState>({
    open: false,
    userId: '',
    date: '',
    shift: null,
  });

  const handleCellClick = useCallback(
    ({ userId, date, shift }: { userId: string; date: string; shift: ShiftRow | null }) => {
      setEditorState({ open: true, userId, date, shift });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Shift lookup map (O(1) per cella)
  // -----------------------------------------------------------------------
  const shiftMap = useMemo(() => {
    const map = new Map<string, ShiftRow>();
    shifts.forEach((s) => {
      map.set(`${s.userId}:${s.date}`, s);
    });
    return map;
  }, [shifts]);

  const absenceMap = useMemo(() => {
    const map = new Map<string, AbsenceRow>();
    absences.forEach((a) => {
      const days = eachDayOfInterval({
        start: new Date(a.startDate),
        end: new Date(a.endDate),
      });
      days.forEach((d) => {
        map.set(`${a.userId}:${format(d, 'yyyy-MM-dd')}`, a);
      });
    });
    return map;
  }, [absences]);

  // -----------------------------------------------------------------------
  // Filtered employees
  // -----------------------------------------------------------------------
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q),
      );
    }

    if (selectedQualification !== 'all') {
      result = result.filter(
        (e) => e.qualificationId === selectedQualification,
      );
    }

    return result;
  }, [employees, searchValue, selectedQualification]);

  // -----------------------------------------------------------------------
  // Build TanStack Table columns
  // -----------------------------------------------------------------------
  const isCompact = viewMode === 'month';
  const dayColWidth = isCompact ? MONTH_DAY_COL_WIDTH : WEEK_DAY_COL_WIDTH;

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(() => {
    const employeeCol: ColumnDef<EmployeeRow> = {
      id: 'employee',
      accessorFn: (row) => `${row.lastName} ${row.firstName}`,
      header: () => (
        <div className="flex items-center px-2 py-1 text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Dipendente
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col px-2 py-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">
            {row.original.lastName} {row.original.firstName}
          </span>
          {row.original.qualificationName && (
            <span
              className="text-xs truncate"
              style={{ color: row.original.qualificationColor ?? '#6B7280' }}
            >
              {row.original.qualificationName}
            </span>
          )}
        </div>
      ),
      size: EMPLOYEE_COL_WIDTH,
      enableColumnFilter: false,
    };

    const dayColumns: ColumnDef<EmployeeRow>[] = periodRange.days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      const isWeekend = [0, 6].includes(day.getDay()); // 0=Sun, 6=Sat

      return {
        id: dateStr,
        header: () => (
          <div
            className={[
              'flex flex-col items-center justify-center py-1 text-center',
              isToday ? 'text-blue-600 font-bold' : 'text-gray-600',
            ].join(' ')}
          >
            {isCompact ? (
              <span className="text-xs leading-none">{format(day, 'd')}</span>
            ) : (
              <>
                <span className="text-xs uppercase">
                  {format(day, 'EEE', { locale: it })}
                </span>
                <span className={['text-sm font-semibold', isToday ? 'text-blue-600' : ''].join(' ')}>
                  {format(day, 'd')}
                </span>
              </>
            )}
          </div>
        ),
        cell: ({ row }) => {
          const shiftForCell = shiftMap.get(`${row.original.id}:${dateStr}`) ?? null;
          const absenceForCell = absenceMap.get(`${row.original.id}:${dateStr}`) ?? null;
          // TODO TSK-006: calcola violazioni reali con il rules engine
          const cellViolations: RuleViolation[] = [];

          return (
            <div
              className={[
                'h-full w-full p-0.5',
                isWeekend ? 'bg-gray-50' : '',
              ].join(' ')}
            >
              <ShiftCell
                userId={row.original.id}
                date={dateStr}
                shift={shiftForCell}
                absence={absenceForCell}
                shiftTypes={shiftTypes}
                isCompact={isCompact}
                violations={cellViolations}
                onCellClick={handleCellClick}
              />
            </div>
          );
        },
        size: dayColWidth,
        enableColumnFilter: false,
      };
    });

    return [employeeCol, ...dayColumns];
  }, [periodRange.days, shiftMap, absenceMap, shiftTypes, isCompact, dayColWidth, handleCellClick]);

  // -----------------------------------------------------------------------
  // Column pinning
  // -----------------------------------------------------------------------
  const columnPinning: ColumnPinningState = useMemo(
    () => ({ left: ['employee'] }),
    [],
  );

  // -----------------------------------------------------------------------
  // TanStack Table
  // -----------------------------------------------------------------------
  const table = useReactTable({
    data: filteredEmployees,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { columnPinning },
    enableColumnPinning: true,
  });

  const rows = table.getRowModel().rows;

  // -----------------------------------------------------------------------
  // TanStack Virtual (righe)
  // -----------------------------------------------------------------------
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'month') {
      // Allinea currentDate all'inizio del mese corrente
      setCurrentDate(startOfMonth(currentDate));
    } else {
      setCurrentDate(startOfISOWeek(currentDate));
    }
  };

  // -----------------------------------------------------------------------
  // Sticky column left offset per column pinning
  // -----------------------------------------------------------------------
  function getPinnedLeft(colId: string): number | undefined {
    if (colId === 'employee') return 0;
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      {/* Filtri */}
      <MatrixFilters
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        selectedQualification={selectedQualification}
        qualifications={qualifications}
        onQualificationChange={setSelectedQualification}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        currentDate={currentDate}
        onNavigate={handleNavigate}
      />

      {/* Stato loading */}
      {(weekQuery.isFetching || monthQuery.isFetching) && (
        <div
          className="h-0.5 w-full animate-pulse rounded-full bg-blue-300"
          role="status"
          aria-label="Caricamento turni in corso"
        />
      )}

      {/* Errore */}
      {(weekQuery.isError || monthQuery.isError) && (
        <div
          className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600"
          role="alert"
        >
          Errore nel caricamento dei turni. Riprova.
        </div>
      )}

      {/* Griglia */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto rounded-lg border border-gray-200 shadow-sm"
        style={{ height: 'calc(100vh - 220px)', maxHeight: '800px' }}
        data-testid="shift-grid-container"
      >
        <table
          className="border-collapse"
          style={{
            width: `${EMPLOYEE_COL_WIDTH + periodRange.days.length * dayColWidth}px`,
            tableLayout: 'fixed',
          }}
          role="grid"
          aria-label="Griglia turni dipendenti"
          aria-rowcount={rows.length + 1}
          aria-colcount={columns.length}
        >
          {/* Header sticky */}
          <thead
            className="sticky top-0 z-20 bg-white"
            style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.1)' }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header, colIdx) => {
                  const isPinned = header.column.getIsPinned();
                  return (
                    <th
                      key={header.id}
                      role="columnheader"
                      aria-colindex={colIdx + 1}
                      className={[
                        'border-b border-gray-200 bg-white',
                        isPinned === 'left'
                          ? 'sticky left-0 z-30 shadow-[2px_0_4px_rgba(0,0,0,0.05)]'
                          : '',
                      ].join(' ')}
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                        left: isPinned === 'left'
                          ? getPinnedLeft(header.id)
                          : undefined,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body virtualizzato */}
          <tbody
            style={{
              height: `${totalHeight}px`,
              position: 'relative',
              display: 'block',
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <tr
                  key={row.id}
                  role="row"
                  aria-rowindex={virtualRow.index + 2}
                  className="hover:bg-blue-50/30"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex',
                  }}
                >
                  {row.getVisibleCells().map((cell, colIdx) => {
                    const isPinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        role="gridcell"
                        aria-colindex={colIdx + 1}
                        className={[
                          'flex-shrink-0 overflow-hidden border-b border-gray-100',
                          isPinned === 'left'
                            ? 'sticky left-0 z-10 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.05)]'
                            : 'bg-white',
                        ].join(' ')}
                        style={{
                          width: cell.column.getSize(),
                          minWidth: cell.column.getSize(),
                          left: isPinned === 'left'
                            ? getPinnedLeft(cell.column.id)
                            : undefined,
                          height: `${virtualRow.size}px`,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-gray-500">
            Nessun dipendente trovato con i filtri selezionati.
          </div>
        )}
      </div>

      {/* Shift Editor Modal */}
      <ShiftEditor
        open={editorState.open}
        onOpenChange={(open) =>
          setEditorState((prev) => ({ ...prev, open }))
        }
        userId={editorState.userId}
        date={editorState.date}
        shift={editorState.shift}
        shiftTypes={shiftTypes}
      />
    </div>
  );
}
