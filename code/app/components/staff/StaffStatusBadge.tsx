/**
 * components/staff/StaffStatusBadge.tsx — Badge stato dipendente attivo/inattivo.
 *
 * Accessibility: WCAG 2.2 AA
 * - aria-label descrive lo stato al di là del colore
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StaffStatusBadgeProps {
  active: boolean;
  className?: string;
}

export function StaffStatusBadge({ active, className }: StaffStatusBadgeProps) {
  return (
    <Badge
      className={cn(
        'border-transparent text-xs font-medium',
        active
          ? 'bg-green-100 text-green-800 hover:bg-green-100/80'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-100/80',
        className
      )}
      aria-label={active ? 'Dipendente attivo' : 'Dipendente inattivo'}
    >
      {active ? 'Attivo' : 'Inattivo'}
    </Badge>
  );
}
