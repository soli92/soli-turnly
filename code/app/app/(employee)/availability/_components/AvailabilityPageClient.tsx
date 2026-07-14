'use client';

/**
 * app/(employee)/availability/_components/AvailabilityPageClient.tsx (TSK-025)
 *
 * Client component che compone AvailabilityForm + AvailabilityList.
 * TanStack Query gestisce il fetch e l'invalidazione automatica dopo POST/DELETE.
 */

import { AvailabilityForm } from './AvailabilityForm';
import { AvailabilityList } from './AvailabilityList';

export function AvailabilityPageClient() {
  return (
    <div className="space-y-8">
      {/* Sezione aggiungi nuova disponibilità */}
      <section aria-labelledby="availability-form-heading">
        <div className="border-border rounded-lg border bg-white p-6">
          <h2 id="availability-form-heading" className="mb-4 text-base font-semibold text-gray-900">
            Aggiungi disponibilità
          </h2>
          <AvailabilityForm />
        </div>
      </section>

      {/* Sezione lista disponibilità dichiarate */}
      <section aria-labelledby="availability-list-heading">
        <div className="border-border rounded-lg border bg-white p-6">
          <h2 id="availability-list-heading" className="mb-4 text-base font-semibold text-gray-900">
            Disponibilità dichiarate
          </h2>
          <AvailabilityList />
        </div>
      </section>
    </div>
  );
}
