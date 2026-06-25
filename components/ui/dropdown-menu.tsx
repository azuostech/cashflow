import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function DropdownMenuContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-gray-200 bg-white p-1 shadow-md', className)} {...props} />;
}

export function DropdownMenuItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded px-2 py-1.5 text-sm hover:bg-gray-100', className)} {...props} />;
}
