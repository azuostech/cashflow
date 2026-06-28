'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Building2, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useFetch } from '@/hooks/use-fetch';

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
  audit: 'Auditoria',
  profile: 'Meu perfil'
};

function currentMonthValue() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

interface MeResponse {
  user: {
    name: string;
    email: string;
  };
  activeCompanyId: string;
  companies: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const parts = pathname.split('/').filter(Boolean);
  const crumbs = parts.length ? parts.map((part) => labels[part] ?? part) : ['Dashboard'];
  const { data: me, setData } = useFetch<MeResponse>('/api/users/me');
  const [switchingCompany, setSwitchingCompany] = useState(false);

  async function handleCompanyChange(companyId: string) {
    if (!companyId || companyId === me?.activeCompanyId) return;

    setSwitchingCompany(true);
    const response = await fetch('/api/session/switch-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });

    if (!response.ok) {
      setSwitchingCompany(false);
      return;
    }

    const data: { homeRoute?: string } = await response.json();
    setData(
      me
        ? {
            ...me,
            activeCompanyId: companyId
          }
        : null
    );
    router.push(data.homeRoute ?? '/dashboard');
    router.refresh();
    setSwitchingCompany(false);
  }

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
        {me && me.companies.length > 1 ? (
          <label className="relative flex items-center text-gray-700">
            <Building2 className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400" />
            <select
              aria-label="Empresa ativa"
              value={me.activeCompanyId}
              disabled={switchingCompany}
              onChange={(event) => void handleCompanyChange(event.target.value)}
              className="h-10 min-w-48 rounded-md border border-gray-300 bg-white py-2 pl-9 pr-8 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {me.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
        {me?.user ? (
          <Link href="/profile" className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-gray-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {(me.user.name ?? me.user.email ?? '?')[0].toUpperCase()}
            </div>
            <span className="hidden max-w-28 truncate text-xs font-medium text-gray-600 sm:block">{me.user.name ?? me.user.email}</span>
          </Link>
        ) : null}
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
