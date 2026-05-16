'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Building2, CalendarDays, FileOutput, FolderOpen, Home, Settings, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Role = 'admin' | 'consultor' | 'cliente';

const baseItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/fluxo-diario', label: 'Fluxo Diario', icon: CalendarDays },
  { href: '/dashboard/categorias', label: 'Categorias', icon: FolderOpen },
  { href: '/dashboard/upload', label: 'Upload', icon: Upload },
  { href: '/dashboard/relatorios', label: 'Relatorios', icon: FileOutput },
  { href: '/dashboard/configuracoes', label: 'Configuracoes', icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>('cliente');

  useEffect(() => {
    async function loadRole() {
      const response = await fetch('/api/session/context', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      const nextRole = payload?.user?.role;

      if (nextRole === 'admin' || nextRole === 'consultor' || nextRole === 'cliente') {
        setRole(nextRole);
      }
    }

    loadRole().catch(() => setRole('cliente'));
  }, []);

  const items = useMemo(() => {
    if (role === 'admin' || role === 'consultor') {
      return [
        ...baseItems.slice(0, 1),
        { href: '/dashboard/empresas', label: 'Empresas', icon: Building2 },
        ...baseItems.slice(1)
      ];
    }

    return baseItems;
  }, [role]);

  return (
    <aside className="w-full border-r border-app-border bg-white/95 p-4 md:w-[280px]">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="rounded-lg bg-primary p-2 text-white">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-app-subtle">CashFlow</p>
          <p className="text-lg font-bold leading-none">Analyzer</p>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active ? 'bg-primary text-white' : 'text-app-subtle hover:bg-app-muted hover:text-app-text'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
