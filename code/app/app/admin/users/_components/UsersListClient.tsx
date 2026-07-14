'use client';

/**
 * app/(admin)/users/_components/UsersListClient.tsx
 *
 * Tabella utenti con TanStack Query.
 * Link al form di modifica per ciascun utente.
 */

import Link from 'next/link';
import { useUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';

export function UsersListClient() {
  const { data: users, isLoading, isError, error } = useUsers();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-border h-12 animate-pulse rounded-lg border bg-gray-50" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore: {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">Nessun dipendente trovato</p>
        <Button asChild className="mt-3" size="sm">
          <Link href="/admin/users/new">Aggiungi il primo dipendente</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm" aria-label="Lista dipendenti">
        <thead className="border-border border-b bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
              Nome
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
              Email
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
              Ruolo
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
              Qualifica
            </th>
            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-700">
              Stato
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium text-gray-700">
              Azioni
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y bg-white">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3 text-gray-600 capitalize">
                {user.role === 'admin' ? 'Admin' : 'Dipendente'}
              </td>
              <td className="px-4 py-3 text-gray-600">{user.qualificationName ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.active ? 'Attivo' : 'Inattivo'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/users/${user.id}`}>Modifica</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
