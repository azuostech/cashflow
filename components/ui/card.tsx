import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border border-gray-200 bg-white p-5 shadow-sm', className)} {...props} />
  )
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('mb-4', className)} {...props} />
);

CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cn('text-lg font-semibold text-gray-900', className)} {...props} />
);

CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('text-sm text-gray-600', className)} {...props} />
);

CardContent.displayName = 'CardContent';
