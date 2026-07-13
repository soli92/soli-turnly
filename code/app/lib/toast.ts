/**
 * lib/toast.ts — Stub toast per notifiche SSE (TSK-008).
 *
 * Questo modulo esporta un oggetto `toast` compatibile con le chiamate
 * nell'hook useNotifications. Attualmente delega a console.info/warn
 * finché non viene integrato un provider toast (Radix @radix-ui/react-toast
 * o sonner) nel layout radice dell'applicazione.
 *
 * TODO: sostituire con l'implementazione del provider toast scelto.
 */

export const toast = {
  info: (message: string): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[toast:info]', message);
    }
    // TODO: dispatch CustomEvent o invocare provider Radix toast
  },
  success: (message: string): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[toast:success]', message);
    }
  },
  error: (message: string): void => {
    console.error('[toast:error]', message);
  },
};
