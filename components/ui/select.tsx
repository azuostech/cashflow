import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-11 w-full rounded-lg border border-app-border bg-white px-3 text-sm text-app-text shadow-sm outline-none ring-offset-2 transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
