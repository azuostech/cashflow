'use client';

import { Bell, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';

const labels: Record<string, string> = {
  dashboard: 'Dashboard',
  'financial-center': 'Central Financeira',
  transactions: 'Lancamentos',
  payables: 'A Pagar',
  receivables: 'A Receber',
  bank: 'Banco',
  statements: 'Extratos',
  import: 'Importar',
  reconciliation: 'Conciliacao',
  reports: 'Relatorios',
  dre: 'DRE',
  cashflow: 'Fluxo de Caixa',
  settings: 'Configuracoes',
  company: 'Empresa',
  users: 'Usuarios',
  'bank-accounts': 'Contas Bancarias',
  'chart-of-accounts': 'Plano de Contas',
  'cost-centers': 'Centros de Custo',
  contacts: 'Contatos',
  periods: 'Fechamento Mensal',
  audit: 'Auditoria'
};

function currentMonthValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function Header() {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.length ? parts.map((part) => labels[part] ?? part) : ['Dashboard'];

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span>/</span> : null}
              <span className={index === crumbs.length - 1 ? 'font-medium text-gray-900' : ''}>{crumb}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          aria-label="Periodo"
          type="month"
          defaultValue={currentMonthValue()}
          className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="button"
          aria-label="Notificacoes"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Novo Lancamento
        </button>
      </div>
    </header>
  );
}
