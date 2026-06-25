import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Dialog({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-gray-200 bg-white p-6 shadow-lg', className)} {...props} />;
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-gray-900', className)} {...props} />;
}
