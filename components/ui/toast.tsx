import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Toast({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm', className)} {...props} />;
}
