'use client';

/**
 * components/absences/AbsenceForm.tsx — Form registrazione assenza admin (TSK-017).
 *
 * L'admin registra un'assenza per un dipendente.
 * Flusso (F4):
 *   1. Admin compila: dipendente + tipo + date range + note
 *   2. onSubmit → POST /api/admin/absences/check-conflicts (dry-run)
 *      a. Se turni in conflitto → apre AbsenceConflictModal
 *         - Admin sceglie azione per ogni turno
 *         - Conferma → POST /api/admin/absences con conflictResolutions
 *      b. Se nessun conflitto → POST /api/admin/absences direttamente
 *   3. toast + invalidate queries + form reset
 *
 * Validazione (RF-G):
 *   - dipendente obbligatorio
 *   - tipo assenza obbligatorio
 *   - endDate >= startDate
 *
 * Accessibility: WCAG 2.2 AA
 *   - Tutti i campi hanno label via FormLabel (htmlFor)
 *   - FormMessage con role="alert"
 *   - Bottone submit disabilitato durante loading/mutation
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

import { AbsenceConflictModal } from './AbsenceConflictModal';
import { useCheckConflicts, useCreateAbsence } from '@/hooks/useAbsences';
import { toast } from '@/lib/toast';
import type { ShiftConflict } from '@/app/api/admin/absences/check-conflicts/route';
import type { AbsenceAdminWithResolutionsInput } from '@/lib/zod';
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Schema form locale (alias di absenceAdminWithResolutionsSchema, omette resolutions)
// ---------------------------------------------------------------------------

const absenceFormSchema = z
  .object({
    userId: z.string().min(1, 'Seleziona un dipendente'),
    absenceType: z.enum(['ferie', 'malattia', 'permesso', 'maternita-paternita', 'altro'], {
      errorMap: () => ({ message: 'Seleziona il tipo di assenza' }),
    }),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido — atteso YYYY-MM-DD')
      .min(1, 'La data di inizio è obbligatoria'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato data non valido — atteso YYYY-MM-DD')
      .min(1, 'La data di fine è obbligatoria'),
    notes: z.string().max(500, 'Note troppo lunghe (max 500 caratteri)').optional(),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), {
    message: 'La data di fine deve essere uguale o successiva alla data di inizio',
    path: ['endDate'],
  });

type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

// ---------------------------------------------------------------------------
// Tipi assenza (static list — nessuna API disponibile)
// ---------------------------------------------------------------------------

const ABSENCE_TYPES = [
  { id: 'ferie', name: 'Ferie' },
  { id: 'malattia', name: 'Malattia' },
  { id: 'permesso', name: 'Permesso' },
  { id: 'maternita-paternita', name: 'Maternità / Paternità' },
  { id: 'altro', name: 'Altro' },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbsenceFormProps {
  users: Pick<UserRow, 'id' | 'firstName' | 'lastName'>[];
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AbsenceForm({ users, onSuccess }: AbsenceFormProps) {
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState<ShiftConflict[]>([]);
  const [pendingAbsenceData, setPendingAbsenceData] = useState<Omit<
    AbsenceAdminWithResolutionsInput,
    'conflictResolutions'
  > | null>(null);

  const checkConflicts = useCheckConflicts();
  const createAbsence = useCreateAbsence();

  const form = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: {
      userId: '',
      // absenceType omesso: è un required enum — nessun default valido da pre-impostare.
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  // ---------------------------------------------------------------------------
  // Submit: prima check-conflicts, poi crea o apre modal
  // ---------------------------------------------------------------------------

  async function onSubmit(values: AbsenceFormValues) {
    const absenceData: Omit<AbsenceAdminWithResolutionsInput, 'conflictResolutions'> = {
      userId: values.userId,
      absenceType: values.absenceType as AbsenceAdminWithResolutionsInput['absenceType'],
      startDate: values.startDate,
      endDate: values.endDate,
      notes: values.notes ?? null,
    };

    let conflicts: ShiftConflict[] = [];

    try {
      const result = await checkConflicts.mutateAsync({
        userId: values.userId,
        startDate: values.startDate,
        endDate: values.endDate,
      });
      conflicts = result.shifts;
    } catch (err) {
      // Dry-run fallito: il salvataggio viene bloccato (fail-safe).
      // Procedere senza conoscere i conflitti rischierebbe di creare
      // un'assenza senza risolvere turni sovrapposti (corruzione dati).
      console.error('[AbsenceForm] check-conflicts error:', err);
      toast.error(
        'Verifica conflitti non riuscita — impossibile procedere. Riprova tra qualche istante.'
      );
      return;
    }

    if (conflicts.length > 0) {
      // Ci sono conflitti → apri modal risoluzione
      setPendingConflicts(conflicts);
      setPendingAbsenceData(absenceData);
      setConflictModalOpen(true);
    } else {
      // Nessun conflitto → salvataggio diretto
      try {
        await createAbsence.mutateAsync(absenceData);
        form.reset();
        onSuccess?.();
      } catch (err) {
        const error = err as Error & { issues?: Array<{ path: string[]; message: string }> };
        error.issues?.forEach((issue) => {
          const fieldName = issue.path[0] as keyof AbsenceFormValues;
          if (fieldName) {
            form.setError(fieldName, { message: issue.message });
          }
        });
      }
    }
  }

  // Callback dal modal dopo registrazione avvenuta
  function handleConflictSuccess() {
    form.reset();
    setPendingConflicts([]);
    setPendingAbsenceData(null);
    onSuccess?.();
  }

  const isSubmitting = checkConflicts.isPending || createAbsence.isPending;

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="space-y-4"
          aria-label="Registra assenza dipendente"
          noValidate
        >
          {/* Dipendente */}
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Dipendente <span aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger aria-label="Seleziona dipendente">
                      <SelectValue placeholder="Seleziona un dipendente" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo assenza */}
          <FormField
            control={form.control}
            name="absenceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Tipo di assenza <span aria-hidden="true">*</span>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger aria-label="Seleziona tipo di assenza">
                      <SelectValue placeholder="Seleziona il tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {ABSENCE_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Data inizio <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" aria-required="true" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Data fine <span aria-hidden="true">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="date" aria-required="true" disabled={isSubmitting} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Note */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (opzionale)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Note aggiuntive…"
                    rows={3}
                    disabled={isSubmitting}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Errore generico mutation */}
          {createAbsence.isError && (
            <p role="alert" className="text-destructive text-xs">
              {createAbsence.error?.message ?? 'Si è verificato un errore'}
            </p>
          )}
          {checkConflicts.isError && (
            <p role="alert" className="text-destructive text-xs">
              Verifica conflitti non riuscita — salvataggio bloccato. Riprova.
            </p>
          )}

          {/* Azioni */}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {checkConflicts.isPending
                ? 'Verifica conflitti…'
                : createAbsence.isPending
                  ? 'Salvataggio…'
                  : 'Registra assenza'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Modal conflict resolution (aperto solo se ci sono conflitti) */}
      {pendingAbsenceData && (
        <AbsenceConflictModal
          open={conflictModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setConflictModalOpen(false);
              setPendingConflicts([]);
              setPendingAbsenceData(null);
            }
          }}
          conflicts={pendingConflicts}
          absenceData={pendingAbsenceData}
          users={users}
          onSuccess={handleConflictSuccess}
        />
      )}
    </>
  );
}
