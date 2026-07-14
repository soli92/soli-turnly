'use client';

/**
 * components/admin/UserForm.tsx — Form crea/modifica dipendente (admin only).
 *
 * Campi admin: firstName, lastName, email, qualificationId, contractHours, role, active.
 * Schema:
 *   - Crea: adminUserCreateSchema (include password)
 *   - Modifica: adminUserPatchSchema (senza password)
 * Solo l'admin può vedere/modificare qualificationId e contractHours (RB-13).
 *
 * Submit:
 *   - Crea: POST /api/admin/users
 *   - Modifica: PATCH /api/admin/users/{id}
 *
 * Accessibility: WCAG 2.2 AA
 * - Tutti i campi con label associata
 * - aria-required su campi obbligatori
 * - FormMessage con role="alert"
 * - Bottone disabilitato durante la mutation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import {
  adminUserCreateSchema,
  adminUserPatchSchema,
  type AdminUserCreateInput,
  type AdminUserPatchInput,
} from '@/lib/zod';
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
import { userKeys } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface QualificationOption {
  id: string;
  name: string;
}

interface UserFormCreateProps {
  mode: 'create';
  qualifications?: QualificationOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface UserFormEditProps {
  mode: 'edit';
  userId: string;
  defaultValues: AdminUserPatchInput;
  qualifications?: QualificationOption[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

type UserFormProps = UserFormCreateProps | UserFormEditProps;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function UserForm(props: UserFormProps) {
  const { mode, qualifications = [], onSuccess, onCancel } = props;
  const isEdit = mode === 'edit';

  const queryClient = useQueryClient();

  // Schema e default values in base alla modalità
  const createForm = useForm<AdminUserCreateInput>({
    // Cast necessario: zodResolver usa il tipo input dello schema (con opzionali per .default());
    // AdminUserCreateInput è il tipo output (con campi required). exactOptionalPropertyTypes.
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
    defaultValues: isEdit ? (props as UserFormEditProps).defaultValues : {},
  });

  // Usa il form corretto in base alla modalità
  const form = isEdit
    ? (editForm as ReturnType<typeof useForm<AdminUserPatchInput>>)
    : (createForm as unknown as ReturnType<typeof useForm<AdminUserPatchInput>>);

  const mutation = useMutation({
    mutationFn: async (data: AdminUserCreateInput | AdminUserPatchInput) => {
      const url = isEdit
        ? `/api/admin/users/${(props as UserFormEditProps).userId}`
        : '/api/admin/users';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        const err = new Error(body.error ?? `Errore ${res.status}`) as Error & {
          issues?: Array<{ path: string[]; message: string }>;
        };
        // NOTE: assegnazione condizionale per exactOptionalPropertyTypes (err.issues è optional).
        if (body.issues) err.issues = body.issues;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userKeys.adminList() });
      form.reset();
      onSuccess?.();
    },
    onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
      err.issues?.forEach((issue) => {
        const fieldName = issue.path[0] as keyof AdminUserCreateInput;
        if (fieldName) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (form as any).setError(fieldName, { message: issue.message });
        }
      });
    },
  });

  function onSubmit(data: AdminUserCreateInput | AdminUserPatchInput) {
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit={(form as any).handleSubmit(onSubmit)}
        className="space-y-4"
        aria-label={isEdit ? 'Modifica dipendente' : 'Crea dipendente'}
        noValidate
      >
        {/* Nome e cognome */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={(form as any).control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Mario"
                    aria-required="true"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={(form as any).control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cognome</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Rossi"
                    aria-required="true"
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={(form as any).control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="mario.rossi@esempio.it"
                  aria-required="true"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password — solo in modalità crea */}
        {!isEdit && (
          <FormField
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={(form as any).control}
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

        {/* Ruolo */}
        <FormField
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={(form as any).control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ruolo</FormLabel>
              <FormControl>
                <Select value={field.value ?? 'employee'} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Seleziona ruolo">
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

        {/* Qualifica (RB-13 — solo admin) */}
        {qualifications.length > 0 && (
          <FormField
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={(form as any).control}
            name="qualificationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Qualifica</FormLabel>
                <FormControl>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger aria-label="Seleziona qualifica">
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
        )}

        {/* Ore contratto (RB-13 — solo admin) */}
        <FormField
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          control={(form as any).control}
          name="contractHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ore contratto settimanali</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  aria-required="true"
                  {...field}
                  value={field.value ?? 36}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormDescription>Da 1 a 60 ore settimanali (RB-13)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Errore generico */}
        {mutation.isError && (
          <p role="alert" className="text-destructive text-xs">
            {mutation.error?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={mutation.isPending}
            >
              Annulla
            </Button>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? isEdit
                ? 'Salvataggio...'
                : 'Creazione...'
              : isEdit
                ? 'Salva modifiche'
                : 'Crea dipendente'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
