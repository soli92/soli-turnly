'use client';

/**
 * app/(admin)/recurrence/new/page.tsx — Wizard creazione ricorrenza (admin).
 *
 * Client Component: ospita il wizard a 3 step per la definizione e
 * generazione di ricorrenze/cicli rotativi.
 *
 * L'autenticazione / gate admin è già eseguita dal layout (admin/layout.tsx).
 * Questa pagina non ha bisogno di un gate aggiuntivo.
 *
 * RF-E — Gestione ricorrenze e cicli rotativi
 * Riferimento: TSK-019, ADR-001, requisiti-funzionali RF-E
 */

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecurrenceWizard } from '@/components/recurrence/RecurrenceWizard';

export default function NewRecurrencePage() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb / navigazione indietro */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/recurrence">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            Lista ricorrenze
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuova ricorrenza</h1>
        <p className="mt-1 text-sm text-gray-500">
          Segui i 3 passi per definire il tipo, i dipendenti e generare i turni automatici.
        </p>
      </div>

      <RecurrenceWizard />
    </div>
  );
}
