'use client';

import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children?: ReactNode;
}

export function FormField({ id, label, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
