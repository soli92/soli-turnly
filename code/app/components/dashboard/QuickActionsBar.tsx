'use client';

/**
 * components/dashboard/QuickActionsBar.tsx — Scorciatoie azioni frequenti admin (TSK-014).
 *
 * Barra di accesso rapido alle azioni più comuni per l'admin:
 *   - Nuova assegnazione turno → naviga a /admin/matrix
 *   - Nuova assenza → naviga a /admin/absences
 *
 * Ogni azione è un `<Link>` semantico, raggiungibile con Tab (WCAG 2.2 AA focus order).
 *
 * Accessibility (WCAG 2.2 AA):
 *   - Landmark `<nav>` con aria-label descrittivo
 *   - Ogni bottone ha testo visibile (nessun icon-only senza label)
 *   - Focus ring visibile via focus-visible:ring-2
 */

import Link from 'next/link';
import { CalendarPlus, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Tipo azione
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  iconClassName: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Nuova assegnazione',
    description: 'Aggiungi o modifica un turno dalla matrice',
    href: '/admin/matrix',
    icon: CalendarPlus,
    iconClassName: 'bg-primary/10 text-primary dark:bg-primary/20',
  },
  {
    label: 'Nuova assenza',
    description: "Registra un'assenza per un dipendente",
    href: '/admin/absences',
    icon: UserMinus,
    iconClassName: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  },
];

// ---------------------------------------------------------------------------
// QuickActionsBar
// ---------------------------------------------------------------------------

export function QuickActionsBar() {
  return (
    <nav aria-label="Azioni rapide" data-testid="quick-actions-bar">
      <p className="text-muted-foreground mb-3 text-sm font-medium">Azioni rapide</p>
      <ul role="list" className="flex flex-wrap gap-3">
        {QUICK_ACTIONS.map(({ label, description, href, icon: Icon, iconClassName }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                'group border-border bg-card flex items-center gap-3 rounded-xl border px-4 py-3',
                'shadow-sm transition-shadow hover:shadow-md',
                'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
              )}
              aria-label={label}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  iconClassName
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-foreground group-hover:text-primary text-sm font-medium">
                  {label}
                </p>
                <p className="text-muted-foreground truncate text-xs">{description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
