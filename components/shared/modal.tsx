'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button type="button" aria-label="Fechar modal" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative mx-4 flex max-h-[90vh] w-full flex-col rounded-lg bg-white shadow-xl', widths[size])}>
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="ml-4 text-lg leading-none text-gray-400 hover:text-gray-600" aria-label="Fechar">
            x
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
