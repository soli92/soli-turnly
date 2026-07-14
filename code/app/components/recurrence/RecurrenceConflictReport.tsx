'use client';

/**
 * components/recurrence/RecurrenceConflictReport.tsx
 *
 * Lista conflitti rilevati dalla preview ricorrenza, collassabile per dipendente.
 * Mostra: conflitti da assenza approvata, festivo, sovrapposizione.
 *
 * RB-11: le occorrenze con assenza approvata sono mostrate come "Saltata (assenza)".
 *
 * Accessibility: WCAG 2.2 AA
 *   - Ogni sezione dipendente usa <details>/<summary> nativo (accessibile out-of-the-box)
 *   - role="list" su <ul> per screen reader
 *   - Icone decorative con aria-hidden="true"
 *
 * TSK-019
 */

import { AlertCircle, Calendar, CalendarOff, ArrowLeftRight } from 'lucide-react';
import type { RecurrenceConflict } from '@/hooks/useRecurrences';
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Utility: label motivo conflitto
// ---------------------------------------------------------------------------

function reasonLabel(reason: RecurrenceConflict['reason']): string {
  switch (reason) {
    case 'absence':
      return 'Assenza approvata';
    case 'holiday':
      return 'Festività';
    case 'overlap':
      return 'Sovrapposizione turno';
  }
}

function reasonIcon(reason: RecurrenceConflict['reason']) {
  switch (reason) {
    case 'absence':
      return <CalendarOff className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />;
    case 'holiday':
      return <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-hidden="true" />;
    case 'overlap':
      return <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden="true" />;
  }
}

/** Formatta "YYYY-MM-DD" → "Giorno gg/mm/aaaa". */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return isoDate;
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return `${days[d.getDay()] ?? ''} ${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecurrenceConflictReportProps {
  /** Lista conflitti dalla risposta preview. */
  conflicts: RecurrenceConflict[];
  /** Mappa userId → UserRow per mostrare il nome del dipendente. */
  userMap: Map<string, UserRow>;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecurrenceConflictReport({ conflicts, userMap }: RecurrenceConflictReportProps) {
  if (conflicts.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Nessun conflitto rilevato. Tutti i turni verranno generati.
      </div>
    );
  }

  // Raggruppa conflitti per userId
  const grouped = new Map<string, RecurrenceConflict[]>();
  for (const conflict of conflicts) {
    const group = grouped.get(conflict.userId) ?? [];
    group.push(conflict);
    grouped.set(conflict.userId, group);
  }

  // Conta per tipo
  const absenceCount = conflicts.filter((c) => c.reason === 'absence').length;
  const holidayCount = conflicts.filter((c) => c.reason === 'holiday').length;
  const overlapCount = conflicts.filter((c) => c.reason === 'overlap').length;

  return (
    <div className="space-y-3">
      {/* Riepilogo contatori */}
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="space-y-0.5 text-sm text-amber-800">
            <p className="font-medium">
              {conflicts.length} turno{conflicts.length !== 1 ? 'i' : ''} verranno saltati:
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-700" role="list">
              {absenceCount > 0 && <li>{absenceCount} per assenza approvata (RB-11)</li>}
              {holidayCount > 0 && <li>{holidayCount} per festività</li>}
              {overlapCount > 0 && <li>{overlapCount} per sovrapposizione</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Dettaglio per dipendente — collassabile */}
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([userId, userConflicts]) => {
          const user = userMap.get(userId);
          const userName = user
            ? `${user.firstName} ${user.lastName}`
            : `Dipendente (${userId.slice(0, 8)}…)`;

          return (
            <details key={userId} className="border-border rounded-lg border bg-white text-sm">
              <summary className="focus-visible:ring-ring flex cursor-pointer items-center justify-between rounded-lg px-4 py-2.5 font-medium text-gray-700 select-none hover:bg-gray-50 focus:outline-none focus-visible:ring-2">
                <span>{userName}</span>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {userConflicts.length} conflitt{userConflicts.length !== 1 ? 'i' : 'o'}
                </span>
              </summary>
              <ul
                className="divide-border border-border divide-y border-t"
                role="list"
                aria-label={`Conflitti di ${userName}`}
              >
                {userConflicts.map((conflict, idx) => (
                  <li
                    key={`${conflict.userId}-${conflict.date}-${idx}`}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600"
                  >
                    {reasonIcon(conflict.reason)}
                    <span className="tabular-nums">{formatDate(conflict.date)}</span>
                    <span className="text-xs text-gray-500">—</span>
                    <span className="text-xs">{reasonLabel(conflict.reason)}</span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
