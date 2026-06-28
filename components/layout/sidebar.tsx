'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarClock,
  Landmark,
  LayoutDashboard,
  ListChecks,
  ReceiptText,
  Settings,
  Tags,
  UserCircle,
  Users,
  WalletCards,
  Zap
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useSidebarBadges } from '@/hooks/use-sidebar-badges';
import { sidebarBadgeColor } from '@/lib/users/profile';
import { ROLE_LABELS, type AppUserRole } from '@/lib/users/permissions';
import { cn } from '@/lib/utils/cn';

const navigation = [
  {
    title: 'Principal',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/financial-center', label: 'Central Financeira', icon: Zap }
    ]
  },
  {
    title: 'Lancamentos',
    items: [
      { href: '/transactions', label: 'Todos', icon: ReceiptText },
      { href: '/payables', label: 'A Pagar', icon: CalendarClock, badgeKey: 'overduePayables' },
      { href: '/receivables', label: 'A Receber', icon: ListChecks, badgeKey: 'overdueReceivables' }
    ]
  },
  {
    title: 'Banco',
    items: [
      { href: '/bank/statements', label: 'Extratos', icon: ReceiptText },
      { href: '/bank/statements/import', label: 'Importar Extrato', icon: Landmark },
      { href: '/bank/reconciliation', label: 'Conciliacao', icon: ListChecks, badgeKey: 'unreconciled' }
    ]
  },
  {
    title: 'Relatorios',
    items: [
      { href: '/reports/dre', label: 'DRE', icon: BarChart3 },
      { href: '/reports/cashflow', label: 'Fluxo de Caixa', icon: WalletCards }
    ]
  },
  {
    title: 'Config',
    items: [
      { href: '/settings/chart-of-accounts', label: 'Plano de Contas', icon: Tags },
      { href: '/settings/cost-centers', label: 'Centros de Custo', icon: Building2 },
      { href: '/settings/bank-accounts', label: 'Contas Bancarias', icon: Landmark },
      { href: '/settings/contacts', label: 'Contatos', icon: Users },
      { href: '/settings/users', label: 'Usuarios', icon: Users },
      { href: '/settings/periods', label: 'Fechamento Mensal', icon: CalendarClock },
      { href: '/settings/audit', label: 'Auditoria', icon: Settings }
    ]
  }
];

interface MeResponse {
  name: string;
  email: string;
  activeRole: AppUserRole;
}

export function Sidebar() {
  const pathname = usePathname();
  const badges = useSidebarBadges();
  const { data: me } = useFetch<MeResponse>('/api/users/me');

  function getBadge(href: string, badgeKey?: string) {
    if (!badgeKey) return null;
    const count = badges[badgeKey as keyof typeof badges] ?? 0;
    if (count <= 0) return null;

    const type = badgeKey === 'overduePayables' ? 'payable' : badgeKey === 'overdueReceivables' ? 'receivable' : 'recon';
    return {
      count,
      className: sidebarBadgeColor(count, type),
      active: pathname === href || pathname.startsWith(`${href}/`)
    };
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col bg-gray-900 text-gray-100">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">CashFlowAI</p>
        <h1 className="mt-1 text-xl font-semibold">Finance OS</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge = getBadge(item.href, item.badgeKey);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition',
                      active ? 'bg-emerald-500 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {badge ? (
                      <span
                        className={cn(
                          'min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold text-white',
                          badge.active ? 'bg-white/25' : badge.className
                        )}
                      >
                        {badge.count > 99 ? '99+' : badge.count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          href="/profile"
          className={cn(
            'mb-3 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition',
            pathname === '/profile' ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
          )}
        >
          <UserCircle className="h-4 w-4" />
          Meu perfil
        </Link>
        <Link href="/profile" className="flex items-center gap-3 rounded-md px-3 py-2 transition hover:bg-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
            {(me?.name ?? me?.email ?? 'CF')[0].toUpperCase()}
          </div>
          <div>
            <p className="max-w-[180px] truncate text-sm font-semibold">{me?.name ?? me?.email ?? 'Usuario logado'}</p>
            <p className="text-xs text-gray-400">{me?.activeRole ? ROLE_LABELS[me.activeRole] : 'Perfil'}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
