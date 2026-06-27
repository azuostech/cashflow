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
  Users,
  WalletCards,
  Zap
} from 'lucide-react';
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
      { href: '/payables', label: 'A Pagar', icon: CalendarClock },
      { href: '/receivables', label: 'A Receber', icon: ListChecks }
    ]
  },
  {
    title: 'Banco',
    items: [
      { href: '/bank/statements', label: 'Extratos', icon: ReceiptText },
      { href: '/bank/statements/import', label: 'Importar Extrato', icon: Landmark },
      { href: '/bank/reconciliation', label: 'Conciliacao', icon: ListChecks, badge: '12' }
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

export function Sidebar() {
  const pathname = usePathname();

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
                    {item.badge ? (
                      <span className={cn('rounded-full px-2 py-0.5 text-xs', active ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-200')}>
                        {item.badge}
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
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">CF</div>
          <div>
            <p className="text-sm font-semibold">Usuario logado</p>
            <p className="text-xs text-gray-400">owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
