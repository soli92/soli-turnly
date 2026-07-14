'use client';

/**
 * components/profile/ProfileForm.tsx — Modifica profilo dipendente.
 *
 * Campi consentiti: firstName, lastName (da userPatchSchema — RB-13, T-SEC-04).
 * Campi contrattuali (qualifica, ore contratto): mostrati in sola lettura,
 * NON nel form, non inviati all'API.
 *
 * Schema: userPatchSchema (strict — non include qualificationId, contractHours).
 * Submit → PATCH /api/users/me
 *
 * Accessibility: WCAG 2.2 AA
 * - Tutti i campi modificabili con label via FormLabel (htmlFor)
 * - Campi read-only con aria-readonly
 * - FormMessage con role="alert" + aria-live="polite"
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { userPatchSchema, type UserPatchInput } from '@/lib/zod';
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
import { usePatchMe, type MeRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProfileFormProps {
  user: MeRow;
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ProfileForm({ user, onSuccess }: ProfileFormProps) {
  const mutation = usePatchMe();

  const form = useForm<UserPatchInput>({
    resolver: zodResolver(userPatchSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });

  function onSubmit(data: UserPatchInput) {
    mutation.mutate(data, {
      onSuccess: () => {
        form.reset(data);
        onSuccess?.();
      },
      onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
        err.issues?.forEach((issue) => {
          const fieldName = issue.path[0] as keyof UserPatchInput;
          if (fieldName) {
            form.setError(fieldName, { message: issue.message });
          }
        });
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Form campi modificabili */}
      <Form {...form}>
        <form
          onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
          className="space-y-4"
          aria-label="Modifica profilo"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
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
              control={form.control}
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

          {/* Email — read only (non modificabile dal dipendente) */}
          <div className="space-y-2">
            <label
              className="text-sm leading-none font-medium text-gray-500"
              htmlFor="profile-email-display"
            >
              Email (non modificabile)
            </label>
            <p
              id="profile-email-display"
              className="border-input text-muted-foreground flex h-9 w-full items-center rounded-md border bg-gray-50 px-3 py-1 text-sm"
              aria-readonly="true"
            >
              {user.email}
            </p>
          </div>

          {/* Errore generico */}
          {mutation.isError && (
            <p role="alert" className="text-destructive text-xs">
              {mutation.error?.message ?? 'Si è verificato un errore'}
            </p>
          )}

          {/* Successo */}
          {mutation.isSuccess && (
            <p role="status" className="text-xs text-green-700">
              Profilo aggiornato con successo
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvataggio...' : 'Salva modifiche'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Sezione dati contrattuali — sola lettura (RB-13, T-SEC-04) */}
      <div className="border-border space-y-3 rounded-lg border bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">Dati contrattuali (sola lettura)</h3>
        <p className="text-xs text-gray-500">
          Questi dati sono gestiti dall&apos;amministrazione. Per modificarli contatta il tuo
          responsabile.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Ruolo</p>
            <p className="text-muted-foreground text-sm capitalize">
              {user.role === 'admin' ? 'Amministratore' : 'Dipendente'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
              Ore contratto
            </p>
            <p className="text-muted-foreground text-sm">{user.contractHours}h / settimana</p>
          </div>
          {user.qualificationName && (
            <div className="col-span-2 space-y-1">
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Qualifica</p>
              <p className="text-muted-foreground text-sm">{user.qualificationName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
