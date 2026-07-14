import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility per la composizione di classi Tailwind CSS.
 * Combina `clsx` (classi condizionali) e `tailwind-merge` (deduplicazione classi Tailwind).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * cn("text-sm font-medium", { "text-muted": disabled })
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
