import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Panoramica turni e notifiche — area amministratore",
};

/**
 * Admin dashboard — placeholder.
 * Implementazione completa in TSK-004 (Admin UI).
 *
 * Features pianificate:
 * - Riepilogo copertura giornaliera
 * - Coda approvazioni richieste (badge)
 * - Accesso rapido matrice turni (TSK-005)
 * - Notifiche real-time via SSE (TSK-009)
 */
export default function AdminDashboardPage() {
  return (
    <section aria-label="Dashboard amministratore">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Panoramica turni, copertura e richieste in attesa
          </p>
        </div>

        {/* Placeholder cards — implementazione in TSK-004 */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Turni oggi", value: "—" },
            { label: "Richieste in attesa", value: "—" },
            { label: "Copertura media", value: "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-surface p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-muted">{label}</p>
              <p className="mt-2 text-3xl font-bold text-text">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-muted">
          Implementazione completa in TSK-004.
        </p>
      </div>
    </section>
  );
}
