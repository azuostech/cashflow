import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);

Select.displayName = 'Select';
