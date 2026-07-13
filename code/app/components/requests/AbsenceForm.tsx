'use client';

/**
 * components/requests/AbsenceForm.tsx — Form registra assenza (admin).
 *
 * L'admin può registrare un'assenza per conto di qualsiasi dipendente.
 * Campi: userId (Select), absenceTypeId (Select), startDate, endDate, notes.
 * Schema: absenceCreateSchema da @/lib/zod (endDate >= startDate — validato da Zod refine).
 *
 * Submit → POST /api/admin/absences
 *
 * Accessibility: WCAG 2.2 AA
 * - Tutti i campi associati a label via FormLabel (htmlFor)
 * - FormMessage con role="alert" + aria-live="polite"
 * - Bottone submit disabilitato durante la mutation (stato loading)
 */

import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { absenceCreateSchema, type AbsenceCreateInput } from '@/lib/zod';
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
import type { UserRow } from '@/hooks/useUsers';

// ---------------------------------------------------------------------------
// Tipi di assenza (configurazione statica — i tipi dinamici vengono da API in TSK-008+)
// ---------------------------------------------------------------------------

const ABSENCE_TYPES = [
  { id: 'ferie', name: 'Ferie' },
  { id: 'malattia', name: 'Malattia' },
  { id: 'permesso', name: 'Permesso' },
  { id: 'maternita-paternita', name: 'Maternità/Paternità' },
  { id: 'altro', name: 'Altro' },
] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AbsenceFormProps {
  users: Pick<UserRow, 'id' | 'firstName' | 'lastName'>[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function AbsenceForm({ users, onSuccess, onCancel }: AbsenceFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<AbsenceCreateInput>({
    resolver: zodResolver(absenceCreateSchema),
    defaultValues: {
      userId: '',
      absenceTypeId: '',
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AbsenceCreateInput) => {
      const res = await fetch('/api/admin/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as {
          error?: string;
          issues?: Array<{ path: string[]; message: string }>;
        };
        const err = new Error(body.error ?? `Errore ${res.status}`) as Error & {
          issues?: Array<{ path: string[]; message: string }>;
        };
        err.issues = body.issues;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absences'] });
      form.reset();
      onSuccess?.();
    },
    onError: (err: Error & { issues?: Array<{ path: string[]; message: string }> }) => {
      err.issues?.forEach((issue) => {
        const fieldName = issue.path[0] as keyof AbsenceCreateInput;
        if (fieldName) {
          form.setError(fieldName, { message: issue.message });
        }
      });
    },
  });

  function onSubmit(data: AbsenceCreateInput) {
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        aria-label="Registra assenza"
        noValidate
      >
        {/* Dipendente */}
        <FormField
          control={form.control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dipendente</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
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
          name="absenceTypeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo di assenza</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
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
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data inizio</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    aria-required="true"
                    {...field}
                  />
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
                <FormLabel>Data fine</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    aria-required="true"
                    {...field}
                  />
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
                  placeholder="Note aggiuntive..."
                  rows={3}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Errore generico */}
        {mutation.isError && (
          <p role="alert" className="text-xs text-destructive">
            {mutation.error?.message ?? 'Si è verificato un errore'}
          </p>
        )}

        {/* Azioni */}
        <div className="flex gap-3 justify-end pt-2">
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
            {mutation.isPending ? 'Salvataggio...' : 'Registra assenza'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
