import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Badge = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700', className)}
      {...props}
    />
  )
);

Badge.displayName = 'Badge';
