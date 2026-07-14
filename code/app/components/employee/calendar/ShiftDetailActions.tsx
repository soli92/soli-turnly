'use client';

/**
 * components/employee/calendar/ShiftDetailActions.tsx
 *
 * Azioni disponibili sul turno nel drawer di dettaglio:
 *   - "Richiedi modifica" → naviga a /requests/new?shiftId=<id>&type=modify_shift
 *   - "Proponi scambio"   → naviga a /requests/new?shiftId=<id>&type=shift_swap
 *
 * I turni cancelled non mostrano azioni (nessuna modifica su turni annullati).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - I pulsanti hanno aria-label descrittivi
 *   - Focus visibile garantito via focus-visible utility
 */

import { useRouter } from 'next/navigation';
import type { ShiftRow } from '@/types';
import { Button } from '@/components/ui/button';

interface ShiftDetailActionsProps {
  shift: ShiftRow;
  onClose?: () => void;
}

export function ShiftDetailActions({ shift, onClose }: ShiftDetailActionsProps) {
  const router = useRouter();

  if (shift.status === 'cancelled') {
    return null;
  }

  function navigate(type: 'modify_shift' | 'shift_swap') {
    const params = new URLSearchParams({ shiftId: shift.id, type });
    onClose?.();
    router.push(`/requests/new?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        aria-label={`Richiedi modifica del turno del ${shift.date}`}
        onClick={() => navigate('modify_shift')}
      >
        Richiedi modifica
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        aria-label={`Proponi scambio per il turno del ${shift.date}`}
        onClick={() => navigate('shift_swap')}
      >
        Proponi scambio
      </Button>
    </div>
  );
}
