'use client';

/**
 * app/(admin)/shift-types/_components/ShiftTypesClient.tsx
 *
 * Client Component: gestisce lo stato apertura del modal "Nuova tipologia"
 * e orchestra ShiftTypeTable + ShiftTypeModal (create).
 *
 * TanStack Query fetcha la lista in modo autonomo.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShiftTypeTable } from '@/components/shift-types/ShiftTypeTable';
import { ShiftTypeModal } from '@/components/shift-types/ShiftTypeModal';

export function ShiftTypesClient() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: inUseMap } = useQuery<Record<string, boolean>>({
    queryKey: ['shift-types', 'in-use'],
    queryFn: async () => {
      const res = await fetch('/api/admin/shift-types/in-use');
      if (!res.ok) throw new Error('Errore recupero tipologie in uso');
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuova tipologia
        </Button>
      </div>

      {/* Tabella */}
      <ShiftTypeTable inUseMap={inUseMap ?? {}} onAddNew={() => setCreateOpen(true)} />

      {/* Modal creazione */}
      <ShiftTypeModal mode="create" open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
