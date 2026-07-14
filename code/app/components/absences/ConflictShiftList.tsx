'use client';

/**
 * components/absences/ConflictShiftList.tsx — Lista turni in conflitto con azioni (TSK-017).
 *
 * Visualizza ogni turno in conflitto con un gruppo radio:
 *   "Annulla" | "Mantieni" | "Riassegna"
 *
 * Per "Riassegna": mostra un Select per scegliere il dipendente sostituto.
 *
 * Le selezioni vengono propagate al parent via `onResolutionsChange`.
 *
 * RF-G CA2: i turni non vengono eliminati silenziosamente — sempre mostrati con azioni.
 *
 * Accessibility: WCAG 2.2 AA
 * - Ogni gruppo radio ha fieldset + legend (nome turno come legend)
 * - aria-required sulle radio
 * - Select sostituto legato a label via htmlFor
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarDays, Clock } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ShiftConflict } from '@/app/api/admin/absences/check-conflicts/route';
import type { ConflictResolution } from '@/lib/zod';
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ConflictShiftListProps {
  /** Turni in conflitto (output del check-conflicts dry-run) */
  conflicts: ShiftConflict[];
  /** Lista utenti per il Select "Riassegna a" */
  users: Pick<UserRow, 'id' | 'firstName' | 'lastName'>[];
  /** Callback: invocata ogni volta che le risoluzioni cambiano */
  onResolutionsChange: (resolutions: ConflictResolution[]) => void;
}

// ---------------------------------------------------------------------------
// Stato locale per ogni riga
// ---------------------------------------------------------------------------

type RowAction = 'annulla' | 'mantieni' | 'riassegna';

interface RowState {
  action: RowAction;
  reassignToUserId: string;
}

// ---------------------------------------------------------------------------
// Helper: label orario da ISO
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

function formatDate(yyyymmdd: string): string {
  return format(new Date(yyyymmdd + 'T00:00:00'), 'EEE dd MMM', { locale: it });
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ConflictShiftList({
  conflicts,
  users,
  onResolutionsChange,
}: ConflictShiftListProps) {
  // Stato per ogni riga: inizializza con action='mantieni'
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.id, { action: 'mantieni', reassignToUserId: '' }]))
  );

  // Notifica il parent quando le risoluzioni cambiano
  useEffect(() => {
    const resolutions: ConflictResolution[] = conflicts.map((c) => {
      const row = rows[c.id] ?? { action: 'mantieni', reassignToUserId: '' };
      return {
        shiftId: c.id,
        action: row.action,
        reassignToUserId:
          row.action === 'riassegna' && row.reassignToUserId ? row.reassignToUserId : null,
      };
    });
    onResolutionsChange(resolutions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  function setRowAction(shiftId: string, action: RowAction) {
    setRows((prev) => ({
      ...prev,
      [shiftId]: { ...prev[shiftId]!, action },
    }));
  }

  function setReassignUser(shiftId: string, userId: string) {
    setRows((prev) => ({
      ...prev,
      [shiftId]: { ...prev[shiftId]!, reassignToUserId: userId },
    }));
  }

  if (conflicts.length === 0) {
    return <p className="py-2 text-sm text-gray-500">Nessun turno in conflitto trovato.</p>;
  }

  return (
    <ul className="space-y-4" aria-label="Turni in conflitto">
      {conflicts.map((conflict, idx) => {
        const row = rows[conflict.id] ?? { action: 'mantieni', reassignToUserId: '' };
        const legendId = `conflict-legend-${conflict.id}`;
        const radioName = `conflict-action-${conflict.id}`;

        return (
          <li key={conflict.id} className="border-border rounded-lg border bg-gray-50 p-4">
            {/* Info turno */}
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDate(conflict.date)}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-900">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {formatTime(conflict.startDt)} – {formatTime(conflict.endDt)}
              </span>
              {conflict.shiftTypeName && (
                <span
                  className="border-border inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-xs font-medium"
                  style={
                    conflict.shiftTypeColor ? { borderColor: conflict.shiftTypeColor } : undefined
                  }
                >
                  {conflict.shiftTypeColor && (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: conflict.shiftTypeColor }}
                      aria-hidden="true"
                    />
                  )}
                  {conflict.shiftTypeName}
                  {conflict.shiftTypeCode && (
                    <span className="text-gray-500">({conflict.shiftTypeCode})</span>
                  )}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {conflict.userFirstName} {conflict.userLastName}
              </span>
            </div>

            {/* Radio gruppo azioni */}
            <fieldset aria-labelledby={legendId}>
              <legend id={legendId} className="mb-2 text-xs font-medium text-gray-700">
                Turno {idx + 1} — Azione:
              </legend>
              <div className="flex flex-wrap gap-4">
                {/* Annulla */}
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={radioName}
                    value="annulla"
                    checked={row.action === 'annulla'}
                    onChange={() => setRowAction(conflict.id, 'annulla')}
                    className="accent-red-600"
                    aria-label="Annulla turno"
                  />
                  <span className="font-medium text-red-700">Annulla</span>
                </label>

                {/* Mantieni */}
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={radioName}
                    value="mantieni"
                    checked={row.action === 'mantieni'}
                    onChange={() => setRowAction(conflict.id, 'mantieni')}
                    className="accent-gray-600"
                    aria-label="Mantieni turno invariato"
                  />
                  <span className="font-medium text-gray-700">Mantieni</span>
                </label>

                {/* Riassegna */}
                <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={radioName}
                    value="riassegna"
                    checked={row.action === 'riassegna'}
                    onChange={() => setRowAction(conflict.id, 'riassegna')}
                    className="accent-blue-600"
                    aria-label="Riassegna turno ad altro dipendente"
                  />
                  <span className="font-medium text-blue-700">Riassegna</span>
                </label>
              </div>
            </fieldset>

            {/* Select dipendente sostituto (solo se "Riassegna") */}
            {row.action === 'riassegna' && (
              <div className="mt-3 space-y-1">
                <label
                  htmlFor={`reassign-user-${conflict.id}`}
                  className="text-xs font-medium text-gray-700"
                >
                  Riassegna a <span aria-hidden="true">*</span>
                </label>
                <Select
                  value={row.reassignToUserId || '__none__'}
                  onValueChange={(v) => setReassignUser(conflict.id, v === '__none__' ? '' : v)}
                >
                  <SelectTrigger
                    id={`reassign-user-${conflict.id}`}
                    className="max-w-xs"
                    aria-label="Seleziona dipendente sostituto"
                    aria-required="true"
                  >
                    <SelectValue placeholder="Seleziona dipendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Seleziona dipendente…
                    </SelectItem>
                    {users
                      .filter((u) => u.id !== conflict.id) // esclude stesso user del turno
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {row.reassignToUserId === '' && (
                  <p className="text-xs text-amber-600" role="alert">
                    Seleziona un dipendente per procedere con la riassegnazione.
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
