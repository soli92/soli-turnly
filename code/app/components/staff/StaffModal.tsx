'use client';

/**
 * components/staff/StaffModal.tsx — Dialog crea/modifica dipendente.
 *
 * Avvolge il form in un shadcn Dialog.
 * Modalità:
 *   - create: POST /api/admin/users
 *   - edit:   PATCH /api/admin/users/{id}
 *
 * Vincoli business implementati:
 *   RF-B CA1: email duplicata → API 422 → form.setError('email', ...)
 *   RF-B CA2: disattivazione → AlertDialog "Il dipendente non potrà ricevere
 *             nuovi turni futuri" prima del submit
 *
 * Campi form:
 *   Identità:     firstName, lastName, email, phone, password (solo create)
 *   Contrattuale: role, contractType, qualificationId, contractHours (1..60), active
 *
 * Accessibility: WCAG 2.2 AA
 *   - Dialog con focus trap (Radix)
 *   - aria-required su campi obbligatori
 *   - role="alert" su errori
 *   - aria-describedby via DialogDescription
 */

import { useState, useEffect } from 'react';
import { useForm, type UseFormReturn, type Control, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  adminUserCreateSchema,
  adminUserPatchSchema,
  type AdminUserCreateInput,
  type AdminUserPatchInput,
} from '@/lib/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateStaff, usePatchStaff } from '@/hooks/useStaff';
import type { StaffRow } from '@/hooks/useStaff';
import type { QualificationOption } from './StaffSearchFilters';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface StaffModalCreateProps {
  mode: 'create';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qualifications: QualificationOption[];
  onSuccess?: () => void;
}

interface StaffModalEditProps {
  mode: 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffRow;
  qualifications: QualificationOption[];
  onSuccess?: () => void;
}

type StaffModalProps = StaffModalCreateProps | StaffModalEditProps;

type StaffFormUnion = UseFormReturn<AdminUserCreateInput> | UseFormReturn<AdminUserPatchInput>;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StaffModal(props: StaffModalProps) {
  const { mode, open, onOpenChange, qualifications, onSuccess } = props;
  const isEdit = mode === 'edit';
  const staff = isEdit ? (props as StaffModalEditProps).staff : null;

  // Stato alert di conferma disattivazione (RF-B CA2)
  const [pendingDeactivation, setPendingDeactivation] = useState(false);
  const [pendingData, setPendingData] = useState<AdminUserPatchInput | null>(null);

  // -----------------------------------------------------------------------
  // Form setup
  // -----------------------------------------------------------------------

  const createForm = useForm<AdminUserCreateInput>({
    resolver: zodResolver(adminUserCreateSchema) as Resolver<AdminUserCreateInput>,
    defaultValues: {
      email: '',
      password: '',
      role: 'employee',
      firstName: '',
      lastName: '',
      qualificationId: null,
      contractHours: 36,
      active: true,
    },
  });

  const editForm = useForm<AdminUserPatchInput>({
    resolver: zodResolver(adminUserPatchSchema),
    defaultValues: staff
      ? {
          email: staff.email,
          role: staff.role,
          firstName: staff.firstName,
          lastName: staff.lastName,
          qualificationId: staff.qualificationId ?? null,
          contractHours: staff.contractHours,
          active: staff.active,
        }
      : {},
  });

  // Reset form quando il modal si apre/chiude o lo staff selezionato cambia
  useEffect(() => {
    if (open) {
      if (isEdit && staff) {
        editForm.reset({
          email: staff.email,
          role: staff.role,
          firstName: staff.firstName,
          lastName: staff.lastName,
          qualificationId: staff.qualificationId ?? null,
          contractHours: staff.contractHours,
          active: staff.active,
        });
      } else if (!isEdit) {
        createForm.reset({
          email: '',
          password: '',
          role: 'employee',
          firstName: '',
          lastName: '',
          qualificationId: null,
          contractHours: 36,
          active: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, staff?.id]);

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const createMutation = useCreateStaff();
  const patchMutation = usePatchStaff();

  const isPending = createMutation.isPending || patchMutation.isPending;

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  function handleCreateSubmit(data: AdminUserCreateInput) {
    createMutation.mutate(data, {
      onSuccess: () => {
        onOpenChange(false);
        onSuccess?.();
      },
      onError: (err) => {
        err.issues?.forEach((issue) => {
          const fieldName = issue.path[0] as keyof AdminUserCreateInput;
          if (fieldName) {
            createForm.setError(fieldName, { message: issue.message });
          }
        });
      },
    });
  }

  function handleEditSubmit(data: AdminUserPatchInput) {
    if (!staff) return;

    // RF-B CA2: richiede conferma se si sta disattivando un dipendente attivo
    if (staff.active && data.active === false) {
      setPendingData(data);
      setPendingDeactivation(true);
      return;
    }

    submitPatch(data);
  }

  function submitPatch(data: AdminUserPatchInput) {
    if (!staff) return;

    patchMutation.mutate(
      { id: staff.id, data },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err) => {
          err.issues?.forEach((issue) => {
            const fieldName = issue.path[0] as keyof AdminUserPatchInput;
            if (fieldName) {
              editForm.setError(fieldName, { message: issue.message });
            }
          });
        },
      }
    );
  }

  function handleDeactivationConfirm() {
    if (pendingData) {
      submitPatch(pendingData);
    }
    setPendingDeactivation(false);
    setPendingData(null);
  }

  function handleDeactivationCancel() {
    setPendingDeactivation(false);
    setPendingData(null);
  }

  // -----------------------------------------------------------------------
  // Render form body (condiviso tra create ed edit)
  // -----------------------------------------------------------------------

  function renderFormBody(form: StaffFormUnion, isCreateMode: boolean) {
    // AdminUserCreateInput and AdminUserPatchInput share all field names used here.
    // Single cast avoids duplicating the entire render tree per form instance.
    const ctrl = form.control as unknown as Control<AdminUserCreateInput>;
    return (
      <div className="space-y-5">
        {/* Sezione identità */}
        <fieldset className="space-y-4">
          <legend className="w-full border-b border-gray-100 pb-1 text-sm font-semibold text-gray-700">
            Dati anagrafici
          </legend>

          {/* Nome e cognome */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={ctrl}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Mario"
                      aria-required="true"
                      data-testid="staff-firstName"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={ctrl}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cognome</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rossi"
                      aria-required="true"
                      data-testid="staff-lastName"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Email */}
          <FormField
            control={ctrl}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="mario.rossi@esempio.it"
                    aria-required="true"
                    autoComplete="email"
                    data-testid="staff-email"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Telefono */}
          <FormField
            control={ctrl}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefono</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="+39 000 0000000"
                    data-testid="staff-phone"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password — solo create */}
          {isCreateMode && (
            <FormField
              control={ctrl}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      aria-required="true"
                      autoComplete="new-password"
                      data-testid="staff-password"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>Minimo 8 caratteri</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </fieldset>

        {/* Sezione contrattuale */}
        <fieldset className="space-y-4">
          <legend className="w-full border-b border-gray-100 pb-1 text-sm font-semibold text-gray-700">
            Dati contrattuali
          </legend>

          {/* Ruolo */}
          <FormField
            control={ctrl}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ruolo</FormLabel>
                <FormControl>
                  <Select value={field.value ?? 'employee'} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Seleziona ruolo" data-testid="staff-role">
                      <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Dipendente</SelectItem>
                      <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo contratto */}
          <FormField
            control={ctrl}
            name="contractType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo contratto</FormLabel>
                <FormControl>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger
                      aria-label="Seleziona tipo contratto"
                      data-testid="staff-contractType"
                    >
                      <SelectValue placeholder="Seleziona tipo contratto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Tempo pieno</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Qualifica */}
          <FormField
            control={ctrl}
            name="qualificationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qualifica</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger
                      aria-label="Seleziona qualifica"
                      data-testid="staff-qualificationId"
                    >
                      <SelectValue placeholder="Nessuna qualifica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuna qualifica</SelectItem>
                      {qualifications.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Ore settimanali */}
          <FormField
            control={ctrl}
            name="contractHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ore settimanali</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    aria-required="true"
                    data-testid="staff-contractHours"
                    {...field}
                    value={field.value ?? 36}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormDescription>Da 1 a 60 ore settimanali</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Stato attivo/inattivo */}
          <FormField
            control={ctrl}
            name="active"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stato</FormLabel>
                <FormControl>
                  <Select
                    value={field.value === true ? 'true' : 'false'}
                    onValueChange={(v) => field.onChange(v === 'true')}
                  >
                    <SelectTrigger
                      aria-label="Seleziona stato dipendente"
                      data-testid="staff-active"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Attivo</SelectItem>
                      <SelectItem value="false">Inattivo</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        {/* Errore generico API */}
        {(createMutation.isError || patchMutation.isError) && (
          <p role="alert" className="text-destructive text-xs">
            {(createMutation.error ?? patchMutation.error)?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex justify-end gap-3 border-t border-gray-100 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annulla
          </Button>
          <Button type="submit" disabled={isPending} data-testid="staff-submit">
            {isPending
              ? isEdit
                ? 'Salvataggio…'
                : 'Creazione…'
              : isEdit
                ? 'Salva modifiche'
                : 'Crea dipendente'}
          </Button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const title = isEdit ? `Modifica — ${staff?.firstName} ${staff?.lastName}` : 'Nuovo dipendente';

  const description = isEdit
    ? 'Modifica i dati anagrafici e contrattuali del dipendente.'
    : 'Inserisci i dati per creare un nuovo dipendente.';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] max-w-lg overflow-y-auto"
          aria-describedby="staff-modal-description"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription id="staff-modal-description">{description}</DialogDescription>
          </DialogHeader>

          {/* Form create */}
          {!isEdit && (
            <Form {...createForm}>
              <form
                onSubmit={(e) => void createForm.handleSubmit(handleCreateSubmit)(e)}
                className="mt-2"
                aria-label="Crea dipendente"
                noValidate
              >
                {renderFormBody(createForm, true)}
              </form>
            </Form>
          )}

          {/* Form edit */}
          {isEdit && (
            <Form {...editForm}>
              <form
                onSubmit={(e) => void editForm.handleSubmit(handleEditSubmit)(e)}
                className="mt-2"
                aria-label="Modifica dipendente"
                noValidate
              >
                {renderFormBody(editForm, false)}
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* RF-B CA2: AlertDialog conferma disattivazione */}
      <AlertDialog
        open={pendingDeactivation}
        onOpenChange={(v) => !v && handleDeactivationCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma disattivazione</AlertDialogTitle>
            <AlertDialogDescription>
              Il dipendente non potrà ricevere nuovi turni futuri. I turni storici e le richieste
              precedenti saranno conservati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeactivationCancel}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivationConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Disattiva dipendente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
