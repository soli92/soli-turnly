/**
 * components/ui/textarea.tsx — shadcn/ui Textarea component.
 *
 * Accessibility: WCAG 2.2 AA
 * - Associato a <label> via htmlFor
 * - focus-visible ring per keyboard navigation
 */

import * as React from 'react';

import { cn } from '@/lib/utils';

// NOTE: type alias usato al posto di interface vuota (no-empty-object-type).
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'border-input flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm',
          'placeholder:text-gray-400',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
