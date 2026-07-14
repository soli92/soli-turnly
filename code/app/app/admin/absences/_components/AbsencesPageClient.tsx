'use client';

/**
 * app/(admin)/absences/_components/AbsencesPageClient.tsx
 *
 * Client Component: orchestra AbsenceForm + AbsenceTable.
 * Gestisce il toast di successo dopo la registrazione.
 *
 * Riceve la lista utenti (prefetchata dal RSC) come prop serializzabile.
 */

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

import { AbsenceForm } from '@/components/absences/AbsenceForm';
import { AbsenceTable } from '@/components/absences/AbsenceTable';

interface UserMinimal {
  id: string;
  firstName: string;
  lastName: string;
}

interface AbsencesPageClientProps {
  users: UserMinimal[];
}

export function AbsencesPageClient({ users }: AbsencesPageClientProps) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleAbsenceSuccess() {
    setSuccessMessage('Assenza registrata con successo.');
    // Auto-dismiss dopo 4 secondi
    setTimeout(() => setSuccessMessage(null), 4000);
  }

  return (
    <div className="space-y-8">
      {/* Toast success */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {successMessage}
        </div>
      )}

      {/* Card form registrazione */}
      <section aria-labelledby="section-form-title">
        <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
          <h2 id="section-form-title" className="mb-4 text-base font-semibold text-gray-900">
            Registra nuova assenza
          </h2>
          <AbsenceForm users={users} onSuccess={handleAbsenceSuccess} />
        </div>
      </section>

      {/* Card tabella assenze */}
      <section aria-labelledby="section-table-title">
        <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
          <h2 id="section-table-title" className="mb-4 text-base font-semibold text-gray-900">
            Assenze registrate
          </h2>
          <AbsenceTable users={users} />
        </div>
      </section>
    </div>
  );
}
