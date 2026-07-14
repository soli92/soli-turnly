/**
 * components/ui/input.tsx — shadcn/ui Input component.
 *
 * Accessibility: WCAG 2.2 AA
 * - Associato a <label> via htmlFor
 * - focus-visible ring per keyboard navigation
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

// NOTE: type alias usato al posto di interface vuota (no-empty-object-type).
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-gray-400',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
