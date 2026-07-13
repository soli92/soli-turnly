'use client';

/**
 * components/matrix/ShiftEditor.tsx — Modal editor turno (crea / modifica).
 *
 * Modalità:
 *   - create: nessun shift esistente → POST /api/shifts
 *   - edit:   shift esistente → PATCH /api/shifts/:id
 *
 * Form fields:
 *   - tipologia turno (Select opzionale)
 *   - data (hidden, da props)
 *   - orario inizio / fine (input time)
 *   - note (textarea)
 *
 * Validazione inline:
 *   - Schema Zod (shiftFormSchema) via react-hook-form
 *   - validateShiftLocal() — stub TSK-005, sostituito in TSK-006
 *   - Violazioni bloccanti: bottone Salva disabilitato
 *   - Solo avvisi: AlertDialog di conferma ("Salva con avvisi")
 *
 * data-testid="shift-editor-dialog" per Playwright (TSK-010)
 *
 * Accessibility: WCAG 2.2 AA
 * - Focus trap in Dialog
 * - aria-describedby su campi con errore
 * - Labels associati via htmlFor
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Trash2, AlertTriangle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ViolationBadge } from './ViolationBadge';

import { useCreateShift, useUpdateShift, useDeleteShift } from '@/hooks/useShifts';
import type { ShiftRow, ShiftTypeRow, RuleViolation } from '@/types';
import { validateShift } from '@/lib/rules';
import type { ExistingShift, Absence } from '@/lib/rules/types';

// ---------------------------------------------------------------------------
// Schema form locale (più semplice di shiftCreateSchema per la UI)
// ---------------------------------------------------------------------------

const shiftFormSchema = z
  .object({
    shiftTypeId: z.string().uuid('UUID non valido').optional().nullable(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido (YYYY-MM-DD)'),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato HH:MM richiesto'),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Formato HH:MM richiesto'),
    notes: z
      .string()
      .max(500, 'Note troppo lunghe (max 500 caratteri)')
      .optional()
      .nullable(),
  })
  .refine(
    (d) => {
      const [sh, sm] = d.startTime.split(':').map(Number);
      const [eh, em] = d.endTime.split(':').map(Number);
      return sh * 60 + sm < eh * 60 + em;
    },
    { message: "L'orario di inizio deve precedere l'orario di fine", path: ['endTime'] },
  );

type ShiftFormValues = z.infer<typeof shiftFormSchema>;

// ---------------------------------------------------------------------------
// Validazione inline via regole RB-01..17 (TSK-006)
// ---------------------------------------------------------------------------

function runLocalValidation(
  data: ShiftFormValues,
  userId: string,
  existingShifts: ExistingShift[],
  absences: Absence[],
  editingId?: string,
): { blocking: RuleViolation[]; warnings: RuleViolation[] } {
  if (!data.startTime || !data.endTime || !data.date) return { blocking: [], warnings: [] };
  const startDt = new Date(`${data.date}T${data.startTime}:00`);
  const endDt = new Date(`${data.date}T${data.endTime}:00`);
  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) return { blocking: [], warnings: [] };
  const result = validateShift(
    { userId, startDt, endDt, id: editingId },
    { existingShifts, absences },
  );
  return { blocking: result.blocking, warnings: result.warnings };
}

// ---------------------------------------------------------------------------
// Helper: ISO datetime da data + orario HH:MM
// ---------------------------------------------------------------------------

function buildISODatetime(date: string, time: string): string {
  // Combina "YYYY-MM-DD" + "HH:MM" in ISO string locale → UTC
  const dt = new Date(`${date}T${time}:00`);
  return dt.toISOString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ShiftEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Dati cella corrente */
  userId: string;
  date: string; // YYYY-MM-DD

  /** Turno da modificare (null per creazione) */
  shift: ShiftRow | null;

  /** Tipi di turno disponibili per il Select */
  shiftTypes: ShiftTypeRow[];

  /** Turni esistenti dell'utente (per validazione RB-01..09) */
  existingShifts?: ExistingShift[];
  /** Assenze dell'utente (per validazione RB-08) */
  absences?: Absence[];
}

export function ShiftEditor({
  open,
  onOpenChange,
  userId,
  date,
  shift,
  shiftTypes,
  existingShifts = [],
  absences = [],
}: ShiftEditorProps) {
  const isEditMode = shift !== null;

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();

  const isPending =
    createShift.isPending || updateShift.isPending || deleteShift.isPending;

  // Deriva orario iniziale da ISO string (es. "2024-07-01T08:00:00.000Z" → "08:00")
  const initialStartTime = shift
    ? format(new Date(shift.startDt), 'HH:mm')
    : '';
  const initialEndTime = shift
    ? format(new Date(shift.endDt), 'HH:mm')
    : '';

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      shiftTypeId: shift?.shiftTypeId ?? null,
      date,
      startTime: initialStartTime,
      endTime: initialEndTime,
      notes: shift?.notes ?? '',
    },
  });

  // Resetta il form quando la cella target cambia
  useEffect(() => {
    form.reset({
      shiftTypeId: shift?.shiftTypeId ?? null,
      date,
      startTime: initialStartTime,
      endTime: initialEndTime,
      notes: shift?.notes ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id, date, userId]);

  const formValues = form.watch();
  const { blocking, warnings } = runLocalValidation(
    formValues,
    userId,
    existingShifts,
    absences,
    shift?.id ?? undefined,
  );
  const hasBlockingViolations = blocking.length > 0;
  const hasWarnings = warnings.length > 0;

  // -----------------------------------------------------------------------
  // Submit handlers
  // -----------------------------------------------------------------------

  async function handleSubmit(data: ShiftFormValues, force = false) {
    if (!force && hasBlockingViolations) return;

    const startDt = buildISODatetime(data.date, data.startTime);
    const endDt = buildISODatetime(data.date, data.endTime);

    try {
      if (isEditMode && shift) {
        await updateShift.mutateAsync({
          id: shift.id,
          data: {
            shiftTypeId: data.shiftTypeId ?? undefined,
            date: data.date,
            startDt,
            endDt,
            notes: data.notes ?? undefined,
          },
        });
      } else {
        await createShift.mutateAsync({
          userId,
          shiftTypeId: data.shiftTypeId ?? undefined,
          date: data.date,
          startDt,
          endDt,
          notes: data.notes ?? undefined,
          status: 'planned',
        });
      }
      onOpenChange(false);
      form.reset();
    } catch {
      // L'errore è gestito da TanStack Query (mutation.error)
    }
  }

  async function handleDelete() {
    if (!shift) return;
    try {
      await deleteShift.mutateAsync(shift.id);
      onOpenChange(false);
    } catch {
      // gestito da mutation.error
    }
  }

  // -----------------------------------------------------------------------
  // Error summary per feedback violazioni
  // -----------------------------------------------------------------------
  const allViolations = [...blocking, ...warnings];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="shift-editor-dialog"
        aria-describedby="shift-editor-description"
      >
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Modifica turno' : 'Nuovo turno'}
          </DialogTitle>
          <DialogDescription id="shift-editor-description">
            {isEditMode
              ? `Modifica il turno del ${date}`
              : `Assegna un turno per il ${date}`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((data) => handleSubmit(data))}
          className="space-y-4"
          noValidate
        >
          {/* Tipologia turno */}
          <div className="space-y-1.5">
            <label
              htmlFor="shiftTypeId"
              className="text-sm font-medium text-gray-700"
            >
              Tipologia turno
            </label>
            <Select
              value={form.watch('shiftTypeId') ?? '__none__'}
              onValueChange={(v) =>
                form.setValue(
                  'shiftTypeId',
                  v === '__none__' ? null : v,
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger
                id="shiftTypeId"
                aria-invalid={!!form.formState.errors.shiftTypeId}
                data-testid="shift-editor-type-select"
              >
                <SelectValue placeholder="Nessuna tipologia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuna tipologia</SelectItem>
                {shiftTypes.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: st.color }}
                        aria-hidden="true"
                      />
                      {st.name} ({st.code})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Orario inizio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="startTime"
                className="text-sm font-medium text-gray-700"
              >
                Inizio <span aria-hidden="true">*</span>
              </label>
              <Input
                id="startTime"
                type="time"
                aria-required="true"
                aria-invalid={!!form.formState.errors.startTime}
                aria-describedby={
                  form.formState.errors.startTime
                    ? 'startTime-error'
                    : undefined
                }
                data-testid="shift-editor-start-time"
                {...form.register('startTime')}
              />
              {form.formState.errors.startTime && (
                <p
                  id="startTime-error"
                  className="text-xs text-red-600"
                  role="alert"
                >
                  {form.formState.errors.startTime.message}
                </p>
              )}
            </div>

            {/* Orario fine */}
            <div className="space-y-1.5">
              <label
                htmlFor="endTime"
                className="text-sm font-medium text-gray-700"
              >
                Fine <span aria-hidden="true">*</span>
              </label>
              <Input
                id="endTime"
                type="time"
                aria-required="true"
                aria-invalid={!!form.formState.errors.endTime}
                aria-describedby={
                  form.formState.errors.endTime ? 'endTime-error' : undefined
                }
                data-testid="shift-editor-end-time"
                {...form.register('endTime')}
              />
              {form.formState.errors.endTime && (
                <p
                  id="endTime-error"
                  className="text-xs text-red-600"
                  role="alert"
                >
                  {form.formState.errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700"
            >
              Note
            </label>
            <Textarea
              id="notes"
              placeholder="Eventuali note sul turno…"
              rows={2}
              aria-invalid={!!form.formState.errors.notes}
              data-testid="shift-editor-notes"
              {...form.register('notes')}
            />
            {form.formState.errors.notes && (
              <p className="text-xs text-red-600" role="alert">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          {/* Violations summary */}
          {allViolations.length > 0 && (
            <div
              className={[
                'rounded-md px-3 py-2 text-xs',
                hasBlockingViolations
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200',
              ].join(' ')}
              role="alert"
              aria-live="polite"
            >
              <ul className="space-y-0.5 list-disc list-inside">
                {allViolations.map((v) => (
                  <li key={v.ruleId}>
                    <span className="font-semibold">{v.ruleId}:</span>{' '}
                    {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Errori mutation */}
          {(createShift.error || updateShift.error) && (
            <p className="text-xs text-red-600" role="alert">
              {(createShift.error ?? updateShift.error)?.message}
            </p>
          )}

          <DialogFooter className="gap-2">
            {/* Bottone Elimina (solo edit mode) */}
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="mr-auto"
                aria-label="Elimina turno"
                data-testid="shift-editor-delete-btn"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Elimina
              </Button>
            )}

            {/* Annulla */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="shift-editor-cancel-btn"
            >
              Annulla
            </Button>

            {/* Salva con avvisi (solo se NO blocking, MA ci sono warning) */}
            {!hasBlockingViolations && hasWarnings && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending || !form.formState.isValid}
                    data-testid="shift-editor-save-warn-btn"
                  >
                    <AlertTriangle className="mr-1 h-4 w-4 text-amber-500" aria-hidden="true" />
                    Salva con avvisi
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conferma salvataggio con avvisi</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sono presenti {warnings.length}{' '}
                      {warnings.length === 1 ? 'avviso' : 'avvisi'} su questo turno.
                      Vuoi salvare comunque?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <ul className="my-2 space-y-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {warnings.map((v) => (
                      <li key={v.ruleId} className="flex items-start gap-1">
                        <ViolationBadge
                          violations={[v]}
                          severity="warning"
                        />
                        <span>
                          <span className="font-semibold">{v.ruleId}:</span>{' '}
                          {v.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        form.handleSubmit((data) =>
                          handleSubmit(data, true),
                        )()
                      }
                      data-testid="shift-editor-confirm-save-btn"
                    >
                      Salva comunque
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Salva (disabled se violazioni bloccanti) */}
            {(!hasWarnings || hasBlockingViolations) && (
              <Button
                type="submit"
                size="sm"
                disabled={isPending || hasBlockingViolations}
                aria-disabled={hasBlockingViolations}
                data-testid="shift-editor-save-btn"
              >
                {isPending ? 'Salvataggio…' : 'Salva'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
