'use client';

/**
 * components/employee/requests/new/RequestReviewStep.tsx
 *
 * Step 3 del wizard nuova richiesta: riepilogo leggibile + invio.
 *
 * Mostra un sommario del payload per il tipo selezionato, poi esegue il
 * POST /api/requests tramite useCreateRequest().
 *
 * On success: toast (lib/toast) + redirect a /requests
 * On error 400 con Zod issues: torna step 2 con errori mappati sui campi
 * On error generico: mostra errore inline
 *
 * "Conferma e invia" è disabilitato durante il POST; spinner visibile.
 *
 * Accessibility: WCAG 2.2 AA
 *   - role="alert" sull'errore generico
 *   - aria-disabled + aria-busy sul bottone di submit
 *   - Liste con role="list" per il riepilogo
 *
 * TSK-023
 */

import { Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateRequest } from '@/hooks/useRequests';
import { toast } from '@/lib/toast';
import type { RequestType } from '@/hooks/useRequests';
import type { AbsencePayload } from './RequestFormAbsence';
import type { SwapPayload } from './RequestFormSwap';
import type { NewShiftPayload } from './RequestFormNewShift';
import type { ModifyShiftPayload } from './RequestFormModifyShift';

// ---------------------------------------------------------------------------
// Costanti UI
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<RequestType, string> = {
  absence: 'Assenza',
  shift_swap: 'Scambio turno',
  new_shift: 'Nuovo turno',
  modify_shift: 'Modifica turno',
};

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  ferie: 'Ferie',
  malattia: 'Malattia',
  permesso: 'Permesso',
  'maternita-paternita': 'Maternità/Paternità',
  altro: 'Altro',
};

// ---------------------------------------------------------------------------
// Helpers formattazione riepilogo
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface ReviewRow {
  label: string;
  value: string;
}

function buildAbsenceRows(payload: AbsencePayload): ReviewRow[] {
  return [
    {
      label: 'Tipo assenza',
      value: ABSENCE_TYPE_LABELS[payload.absenceType] ?? payload.absenceType,
    },
    { label: 'Data inizio', value: formatDate(payload.startDate) },
    { label: 'Data fine', value: formatDate(payload.endDate) },
    ...(payload.notes ? [{ label: 'Note', value: payload.notes }] : []),
  ];
}

function buildSwapRows(payload: SwapPayload): ReviewRow[] {
  return [
    { label: 'Turno ceduto (ID)', value: payload.myShiftId },
    { label: 'Turno richiesto (ID)', value: payload.targetShiftId },
    ...(payload.notes ? [{ label: 'Note', value: payload.notes }] : []),
  ];
}

function buildNewShiftRows(payload: NewShiftPayload): ReviewRow[] {
  return [
    { label: 'Data turno', value: formatDate(payload.date) },
    { label: 'Tipologia (ID)', value: payload.shiftTypeId },
    ...(payload.notes ? [{ label: 'Note', value: payload.notes }] : []),
  ];
}

function buildModifyShiftRows(payload: ModifyShiftPayload): ReviewRow[] {
  const rows: ReviewRow[] = [{ label: 'Turno da modificare (ID)', value: payload.shiftId }];
  if (payload.proposedStartTime)
    rows.push({ label: 'Nuovo orario inizio', value: payload.proposedStartTime });
  if (payload.proposedEndTime)
    rows.push({ label: 'Nuovo orario fine', value: payload.proposedEndTime });
  if (payload.proposedShiftTypeId)
    rows.push({ label: 'Nuova tipologia (ID)', value: payload.proposedShiftTypeId });
  if (payload.proposedChange)
    rows.push({ label: 'Descrizione modifica', value: payload.proposedChange });
  if (payload.notes) rows.push({ label: 'Note', value: payload.notes });
  return rows;
}

function buildRows(type: RequestType, payload: Record<string, unknown>): ReviewRow[] {
  switch (type) {
    case 'absence':
      return buildAbsenceRows(payload as unknown as AbsencePayload);
    case 'shift_swap':
      return buildSwapRows(payload as unknown as SwapPayload);
    case 'new_shift':
      return buildNewShiftRows(payload as unknown as NewShiftPayload);
    case 'modify_shift':
      return buildModifyShiftRows(payload as unknown as ModifyShiftPayload);
  }
}

// ---------------------------------------------------------------------------
// Tipo errore con issues Zod
// ---------------------------------------------------------------------------

type IssueList = Array<{ path: string[]; message: string }>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RequestReviewStepProps {
  type: RequestType;
  payload: Record<string, unknown>;
  onBack: () => void;
  onSuccess: () => void;
  /**
   * Callback invocata con le Zod issues quando il BE risponde 400.
   * Il wizard può usarle per tornare allo step 2 con gli errori precompilati.
   */
  onZodErrors?: (issues: IssueList) => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RequestReviewStep({
  type,
  payload,
  onBack,
  onSuccess,
  onZodErrors,
}: RequestReviewStepProps) {
  const mutation = useCreateRequest();
  const rows = buildRows(type, payload);

  function handleConfirm() {
    mutation.mutate(
      { type, payload },
      {
        onSuccess: () => {
          toast.success(`Richiesta di ${TYPE_LABELS[type].toLowerCase()} inviata con successo.`);
          onSuccess();
        },
        onError: (err: Error & { issues?: IssueList }) => {
          if (err.issues?.length) {
            onZodErrors?.(err.issues);
          }
          // L'errore generico è gestito via mutation.isError sotto
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      {/* Intestazione riepilogo */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-gray-900">
          Riepilogo richiesta — {TYPE_LABELS[type]}
        </h3>
      </div>

      {/* Tabella riepilogo */}
      <dl
        role="list"
        className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white"
      >
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 px-4 py-3" role="listitem">
            <dt className="w-36 shrink-0 text-xs font-medium text-gray-500">{row.label}</dt>
            <dd className="text-xs break-all text-gray-900">{row.value}</dd>
          </div>
        ))}
      </dl>

      {/* Nota sicurezza */}
      <p className="text-muted-foreground text-xs">
        Il payload inviato include solo i campi consentiti per il dipendente (T-SEC-04). La
        validazione finale avviene lato server.
      </p>

      {/* Errore generico */}
      {mutation.isError && (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/5 rounded-md border px-4 py-3"
        >
          <p className="text-destructive text-sm font-medium">
            Errore nell&apos;invio della richiesta
          </p>
          <p className="text-destructive/80 mt-0.5 text-xs">
            {mutation.error?.message ?? 'Si è verificato un errore. Riprova.'}
          </p>
          {(mutation.error as Error & { issues?: IssueList })?.issues?.length ? (
            <p className="text-destructive/70 mt-1 text-xs italic">
              Alcuni campi non sono validi — torna al passo precedente per correggerli.
            </p>
          ) : null}
        </div>
      )}

      {/* Azioni */}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={mutation.isPending}>
          Indietro
        </Button>
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={mutation.isPending}
          data-testid="confirm-submit-btn"
          aria-busy={mutation.isPending}
          aria-disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Invio in corso…
            </>
          ) : (
            'Conferma e invia'
          )}
        </Button>
      </div>
    </div>
  );
}
