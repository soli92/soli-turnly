'use client';

/**
 * app/(admin)/staff/_components/StaffPageClient.tsx — Client orchestrator pagina staff.
 *
 * Riceve i dati iniziali dal RSC (page.tsx) e coordina:
 *   - useStaff() TanStack Query con initialData da SSR
 *   - Filtri (ricerca testo, qualifica, stato)
 *   - Stato modale (create / edit)
 *   - StaffSearchFilters → StaffTable → StaffModal
 */

import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  StaffSearchFilters,
  type QualificationOption,
  type StatusFilter,
} from '@/components/staff/StaffSearchFilters';
import { StaffTable } from '@/components/staff/StaffTable';
import { StaffModal } from '@/components/staff/StaffModal';
import { useStaff, type StaffRow } from '@/hooks/useStaff';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface StaffPageClientProps {
  initialStaff: StaffRow[];
  qualifications: QualificationOption[];
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function StaffPageClient({ initialStaff, qualifications }: StaffPageClientProps) {
  // -----------------------------------------------------------------------
  // TanStack Query — usa initialData dal RSC
  // -----------------------------------------------------------------------

  const { data: allStaffData, isLoading, isError, error } = useStaff(initialStaff);
  const allStaff: StaffRow[] = (allStaffData ?? []) as StaffRow[];

  // -----------------------------------------------------------------------
  // Stato filtri
  // -----------------------------------------------------------------------

  const [searchText, setSearchText] = useState('');
  const [qualificationId, setQualificationId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // -----------------------------------------------------------------------
  // Stato modale
  // -----------------------------------------------------------------------

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRow | null>(null);

  const handleNewStaff = useCallback(() => {
    setEditingStaff(null);
    setModalOpen(true);
  }, []);

  const handleEditStaff = useCallback((staff: StaffRow) => {
    setEditingStaff(staff);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) setEditingStaff(null);
  }, []);

  // -----------------------------------------------------------------------
  // Filtri client-side
  // -----------------------------------------------------------------------

  const filteredStaff = useMemo(() => {
    let result = allStaff;

    // Ricerca testo: nome, cognome, email
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q)
      );
    }

    // Filtro qualifica
    if (qualificationId !== 'all') {
      result = result.filter((s) => s.qualificationId === qualificationId);
    }

    // Filtro stato
    if (statusFilter === 'active') {
      result = result.filter((s) => s.active);
    } else if (statusFilter === 'inactive') {
      result = result.filter((s) => !s.active);
    }

    return result;
  }, [allStaff, searchText, qualificationId, statusFilter]);

  // -----------------------------------------------------------------------
  // Render — stati caricamento/errore
  // -----------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Caricamento dipendenti">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border h-12 animate-pulse rounded-lg border bg-gray-50" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">
          Errore nel caricamento dei dipendenti:{' '}
          {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render principale
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header + bottone nuovo */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {filteredStaff.length === allStaff.length
              ? `${allStaff.length} dipendent${allStaff.length === 1 ? 'e' : 'i'}`
              : `${filteredStaff.length} di ${allStaff.length} dipendent${allStaff.length === 1 ? 'e' : 'i'}`}
          </p>
        </div>
        <Button
          onClick={handleNewStaff}
          data-testid="staff-new-btn"
          aria-label="Crea nuovo dipendente"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Nuovo dipendente
        </Button>
      </div>

      {/* Filtri */}
      <StaffSearchFilters
        searchText={searchText}
        onSearchChange={setSearchText}
        qualificationId={qualificationId}
        qualifications={qualifications}
        onQualificationChange={setQualificationId}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Tabella */}
      <StaffTable rows={filteredStaff} qualifications={qualifications} onEdit={handleEditStaff} />

      {/* Modale crea/modifica */}
      {modalOpen && editingStaff ? (
        <StaffModal
          mode="edit"
          open={modalOpen}
          onOpenChange={handleModalClose}
          staff={editingStaff}
          qualifications={qualifications}
        />
      ) : (
        <StaffModal
          mode="create"
          open={modalOpen}
          onOpenChange={handleModalClose}
          qualifications={qualifications}
        />
      )}
    </div>
  );
}
