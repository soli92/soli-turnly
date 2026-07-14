'use client';

/**
 * components/recurrence/step2-RecurrenceSequenceStep.tsx
 *
 * Step 2 del wizard ricorrenze: configurazione target e date.
 *
 * Campi:
 *   - Target dipendenti: multi-select con filtro qualifica
 *   - Intervallo date: startDate + endDate (input type="date")
 *   - Festivi: toggle "Salta festivi"
 *
 * Validazione:
 *   - endDate > startDate
 *   - almeno 1 dipendente selezionato
 *
 * Accessibility: WCAG 2.2 AA
 *   - Labels espliciti per tutti i controlli
 *   - aria-required sui campi obbligatori
 *   - Checkbox list con role="group" e aria-labelledby
 *   - Messaggi di errore con role="alert"
 *
 * TSK-019, RF-E
 */

import { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUsers } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Tipi dati Step 2
// ---------------------------------------------------------------------------

export interface Step2Data {
  userIds: string[];
  startDate: string;
  endDate: string;
  skipHolidays: boolean;
}

interface Step2Props {
  initialData: Step2Data;
  onComplete: (data: Step2Data) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RecurrenceSequenceStep({ initialData, onComplete, onBack }: Step2Props) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set(initialData.userIds));
  const [startDate, setStartDate] = useState(initialData.startDate);
  const [endDate, setEndDate] = useState(initialData.endDate);
  const [skipHolidays, setSkipHolidays] = useState(initialData.skipHolidays);
  const [qualificationFilter, setQualificationFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const { data: users = [], isLoading: usersLoading, isError: usersError } = useUsers();

  // Qualifiche uniche per il filtro
  const qualifications = useMemo(() => {
    const names = users.map((u) => u.qualificationName).filter((q): q is string => Boolean(q));
    return [...new Set(names)].sort();
  }, [users]);

  // Dipendenti filtrati per qualifica + nome
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchQual = !qualificationFilter || u.qualificationName === qualificationFilter;
      const matchName =
        !nameFilter ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(nameFilter.toLowerCase());
      return matchQual && matchName && u.active;
    });
  }, [users, qualificationFilter, nameFilter]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      for (const u of filteredUsers) {
        next.add(u.id);
      }
      return next;
    });
  }

  function deselectAllFiltered() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      for (const u of filteredUsers) {
        next.delete(u.id);
      }
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Validazione e submit
  // ---------------------------------------------------------------------------

  function handleNext() {
    const errs: string[] = [];

    if (selectedUserIds.size === 0) {
      errs.push('Seleziona almeno un dipendente.');
    }
    if (!startDate) {
      errs.push('Inserisci la data di inizio.');
    }
    if (!endDate) {
      errs.push('Inserisci la data di fine.');
    }
    if (startDate && endDate && endDate <= startDate) {
      errs.push('La data di fine deve essere successiva alla data di inizio.');
    }

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    setErrors([]);
    onComplete({
      userIds: Array.from(selectedUserIds),
      startDate,
      endDate,
      skipHolidays,
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Intervallo date */}
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-gray-700">Intervallo date</legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start-date">
              Data inizio
              <span aria-hidden="true" className="text-destructive ml-1">
                *
              </span>
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-required="true"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-date">
              Data fine
              <span aria-hidden="true" className="text-destructive ml-1">
                *
              </span>
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              aria-required="true"
            />
          </div>
        </div>
      </fieldset>

      {/* Toggle salta festivi */}
      <div className="border-border flex items-center justify-between rounded-lg border px-4 py-3">
        <div>
          <Label
            htmlFor="skip-holidays"
            className="cursor-pointer text-sm font-medium text-gray-700"
          >
            Salta festività
          </Label>
          <p className="mt-0.5 text-xs text-gray-500">
            I turni che cadono in giorni festivi verranno saltati automaticamente.
          </p>
        </div>
        <button
          id="skip-holidays"
          type="button"
          role="switch"
          aria-checked={skipHolidays}
          onClick={() => setSkipHolidays((v) => !v)}
          className={`focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            skipHolidays ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span className="sr-only">
            {skipHolidays ? 'Disattiva salta festività' : 'Attiva salta festività'}
          </span>
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
              skipHolidays ? 'translate-x-5' : 'translate-x-0'
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Selezione dipendenti */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700" id="employees-label">
            Dipendenti target
            <span aria-hidden="true" className="text-destructive ml-1">
              *
            </span>
          </p>
          <span className="text-xs text-gray-500">
            {selectedUserIds.size} selezionat{selectedUserIds.size !== 1 ? 'i' : 'o'}
          </span>
        </div>

        {/* Filtri */}
        <div className="flex gap-2">
          {/* Ricerca per nome */}
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Cerca dipendente…"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              className="h-9 pl-8 text-sm"
              aria-label="Filtra dipendenti per nome"
            />
          </div>

          {/* Filtro qualifica */}
          {qualifications.length > 0 && (
            <select
              value={qualificationFilter}
              onChange={(e) => setQualificationFilter(e.target.value)}
              className="border-input bg-background focus:ring-ring h-9 rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
              aria-label="Filtra per qualifica"
            >
              <option value="">Tutte le qualifiche</option>
              {qualifications.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Azioni seleziona/deseleziona */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllFiltered}
            disabled={filteredUsers.length === 0}
            aria-label="Seleziona tutti i dipendenti filtrati"
          >
            Seleziona tutti ({filteredUsers.length})
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deselectAllFiltered}
            disabled={filteredUsers.length === 0}
            aria-label="Deseleziona tutti i dipendenti filtrati"
          >
            Deseleziona tutti
          </Button>
        </div>

        {/* Lista dipendenti */}
        {usersLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Caricamento dipendenti">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="border-border h-10 animate-pulse rounded-lg border bg-gray-50"
              />
            ))}
          </div>
        ) : usersError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Errore nel caricamento dei dipendenti.
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">
              {nameFilter || qualificationFilter
                ? 'Nessun dipendente trovato con i filtri applicati.'
                : 'Nessun dipendente attivo.'}
            </p>
          </div>
        ) : (
          <div
            role="group"
            aria-labelledby="employees-label"
            className="border-border divide-border max-h-60 divide-y overflow-y-auto rounded-lg border"
          >
            {filteredUsers.map((user) => {
              const isSelected = selectedUserIds.has(user.id);
              return (
                <label
                  key={user.id}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                    isSelected ? 'bg-primary/5' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUser(user.id)}
                    className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
                    aria-label={`Seleziona ${user.firstName} ${user.lastName}`}
                  />
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {user.firstName} {user.lastName}
                    </span>
                    {user.qualificationName && (
                      <span className="text-xs text-gray-500 tabular-nums">
                        {user.qualificationName}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Errori validazione */}
      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <ul className="list-inside list-disc space-y-1" role="list">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigazione */}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Indietro
        </Button>
        <Button type="button" onClick={handleNext}>
          Avanti: Anteprima
        </Button>
      </div>
    </div>
  );
}
