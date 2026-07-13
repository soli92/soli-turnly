import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendario Turni",
  description: "Visualizza i tuoi turni in calendario",
};

/**
 * Employee calendar page — placeholder.
 * Implementazione completa in TSK-008 (Employee UI).
 *
 * Features pianificate:
 * - Calendario mensile/settimanale/giornaliero (React Big Calendar — RF-J)
 * - Self-service: creazione richieste (RF-M)
 * - Richiesta scambio turni
 * - Disponibilità personale
 * - DST-safe display (Europe/Rome, T-DOM-08, RB-12)
 */
export default function EmployeeCalendarPage() {
  return (
    <section aria-label="Calendario turni dipendente">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            I miei turni
          </h1>
          <p className="mt-1 text-sm text-muted">
            Visualizza e gestisci i tuoi turni
          </p>
        </div>

        {/* Placeholder calendar — implementazione in TSK-008 */}
        <div className="rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-muted">
            Calendario turni in arrivo (TSK-008 — React Big Calendar).
          </p>
        </div>
      </div>
    </section>
  );
}
