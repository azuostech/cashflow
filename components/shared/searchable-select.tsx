'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

export interface SearchableSelectOption {
  value: string;
  label: string;
  meta?: string | null;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled,
  allowEmpty = true
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) => {
      return option.label.toLowerCase().includes(query) || (option.meta ?? '').toLowerCase().includes(query);
    });
  }, [options, search]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 text-left text-sm outline-none transition hover:border-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-gray-900' : 'text-gray-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 text-gray-400" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                autoFocus
                placeholder="Buscar"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {allowEmpty ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
                  onClick={() => {
                    onChange('');
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  Nenhum
                </button>
              </li>
            ) : null}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50',
                    option.value === value ? 'bg-emerald-50 text-emerald-700' : 'text-gray-800'
                  )}
                  onClick={() => {
                    onChange(option.value);
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                    {option.meta ? <span className="ml-2 text-xs text-gray-400">{option.meta}</span> : null}
                  </span>
                  {option.value === value ? <Check className="h-4 w-4 flex-shrink-0" /> : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
