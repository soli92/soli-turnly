'use client';

/**
 * components/profile/PasswordForm.tsx — Cambio password dipendente.
 *
 * Campi: oldPassword, newPassword (min 8 chars), confirmPassword.
 * Validazione: newPassword === confirmPassword (refine Zod).
 * Submit → PATCH /api/users/me/password
 *
 * Accessibility: WCAG 2.2 AA
 * - Input password con autoComplete appropriato
 * - FormMessage con role="alert" + aria-live="polite"
 * - Bottone disabilitato durante la mutation
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

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

// ---------------------------------------------------------------------------
// Schema locale (non condiviso con BE — PasswordForm-specific)
// ---------------------------------------------------------------------------

const passwordChangeSchema = z
  .object({
    oldPassword: z.string().min(1, 'La password attuale è obbligatoria'),
    newPassword: z.string().min(8, 'La nuova password deve essere di almeno 8 caratteri'),
    confirmPassword: z.string().min(1, 'Conferma la nuova password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Le password non corrispondono',
    path: ['confirmPassword'],
  });

type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PasswordFormProps {
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function PasswordForm({ onSuccess }: PasswordFormProps) {
  const form = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PasswordChangeInput) => {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
        }),
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
      form.reset();
      onSuccess?.();
    },
    onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
      err.issues?.forEach((issue) => {
        const fieldName = issue.path[0] as keyof PasswordChangeInput;
        if (fieldName) {
          form.setError(fieldName, { message: issue.message });
        }
      });
      // Caso specifico: password attuale errata
      if (
        err.message.toLowerCase().includes('password') &&
        err.message.toLowerCase().includes('errat')
      ) {
        form.setError('oldPassword', { message: err.message });
      }
    },
  });

  function onSubmit(data: PasswordChangeInput) {
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
        className="space-y-4"
        aria-label="Cambio password"
        noValidate
      >
        {/* Password attuale */}
        <FormField
          control={form.control}
          name="oldPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password attuale</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  aria-required="true"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nuova password */}
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nuova password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  aria-required="true"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormDescription>Minimo 8 caratteri</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Conferma password */}
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conferma nuova password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  aria-required="true"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Errore generico */}
        {mutation.isError && !form.formState.errors.oldPassword && (
          <p role="alert" className="text-destructive text-xs">
            {mutation.error?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Successo */}
        {mutation.isSuccess && (
          <p role="status" className="text-xs text-green-700">
            Password aggiornata con successo
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Aggiornamento...' : 'Aggiorna password'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
