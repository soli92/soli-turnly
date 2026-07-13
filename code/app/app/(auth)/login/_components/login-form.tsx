'use client';

/**
 * login-form.tsx — Form di login client-side.
 *
 * Client component: gestisce stato form (errori, loading) e
 * visibilità password tramite React 19 hooks.
 *
 * Il server action viene iniettato da page.tsx come prop,
 * seguendo il pattern Next.js 15 server action composition.
 */

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

// ----------------------------------------------------------------
// Tipi
// ----------------------------------------------------------------

interface LoginFormState {
  error?: string;
}

interface LoginFormProps {
  /** Server action definita in page.tsx con 'use server'. */
  action: (prevState: LoginFormState | null, formData: FormData) => Promise<LoginFormState | null>;
}

// ----------------------------------------------------------------
// Submit button con stato pending (useFormStatus non disponibile
// fuori <form>, usiamo isPending da useActionState)
// ----------------------------------------------------------------

interface SubmitButtonProps {
  isPending: boolean;
}

function SubmitButton({ isPending }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isPending}
      aria-busy={isPending}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Accesso in corso…
        </>
      ) : (
        'Accedi'
      )}
    </button>
  );
}

// ----------------------------------------------------------------
// LoginForm
// ----------------------------------------------------------------

export default function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={formAction}
      noValidate
      aria-label="Form di accesso"
      className="space-y-4"
    >
      {/* Messaggio errore — RF-A CA1: generico, non distingue email/password */}
      {state?.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* Campo email */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-text"
        >
          Indirizzo email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="nome@azienda.it"
          aria-required="true"
        />
      </div>

      {/* Campo password con toggle visibilità */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-text"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={isPending}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 pr-10 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="••••••••"
            aria-required="true"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={isPending}
            aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
            aria-controls="password"
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Submit */}
      <SubmitButton isPending={isPending} />
    </form>
  );
}
