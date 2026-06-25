import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  outline: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  ghost: 'text-gray-700 hover:bg-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700'
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = 'Button';
