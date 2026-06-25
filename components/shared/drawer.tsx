'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg';
}

const widths = {
  md: 'max-w-lg',
  lg: 'max-w-2xl'
};

export function Drawer({ open, onClose, title, description, children, width = 'md' }: DrawerProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar drawer" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('relative flex h-full w-full flex-col bg-white shadow-2xl', widths[width])}>
        <div className="flex flex-shrink-0 items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
