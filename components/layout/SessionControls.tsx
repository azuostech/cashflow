'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';

type UserRole = 'admin' | 'consultor' | 'cliente';

interface ContextPayload {
  user: {
    role: UserRole;
  };
  activeCompanyId: string | null;
  canAccessMultipleCompanies: boolean;
  companies: Array<{
    id: string;
    name: string;
    cnpj: string;
  }>;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  consultor: 'Consultor',
  cliente: 'Cliente'
};

const roleBadgeClass: Record<UserRole, string> = {
  admin: 'bg-secondary/15 text-secondary',
  consultor: 'bg-primary/15 text-primary',
  cliente: 'bg-app-muted text-app-text'
};

export function SessionControls() {
  const router = useRouter();
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadContext() {
    const response = await fetch('/api/session/context', { cache: 'no-store' });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      setContext(null);
      setLoading(false);
      return;
    }

    setContext(payload);
    setLoading(false);
  }

  useEffect(() => {
    loadContext().catch(() => {
      setContext(null);
      setLoading(false);
    });
  }, []);

  const activeCompany = useMemo(() => {
    if (!context?.activeCompanyId) return null;
    return context.companies.find((company) => company.id === context.activeCompanyId) ?? null;
  }, [context]);

  async function switchCompany(companyId: string) {
    setSwitching(true);
    setError(null);

    const response = await fetch('/api/session/active-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? 'Nao foi possivel trocar de empresa.');
      setSwitching(false);
      return;
    }

    setSwitching(false);
    await loadContext();
    router.refresh();
  }

  if (loading || !context) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Badge className={cn('border border-transparent', roleBadgeClass[context.user.role])}>{roleLabels[context.user.role]}</Badge>

      {context.canAccessMultipleCompanies ? (
        <>
          <Select
            value={context.activeCompanyId ?? ''}
            disabled={switching || context.companies.length === 0}
            className="h-10 min-w-[240px] text-xs md:text-sm"
            onChange={(event) => {
              if (!event.target.value) return;
              switchCompany(event.target.value);
            }}
          >
            {context.companies.length === 0 ? <option value="">Nenhuma empresa atribuida</option> : null}
            {context.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </Select>
          <Link href="/dashboard/empresas">
            <Button type="button" variant="outline" className="h-10 px-3 text-xs md:text-sm">
              Painel de empresas
            </Button>
          </Link>
        </>
      ) : null}

      {!context.canAccessMultipleCompanies && activeCompany ? (
        <p className="text-xs text-app-subtle md:text-sm">{activeCompany.name}</p>
      ) : null}

      {error ? <p className="w-full text-right text-xs text-danger">{error}</p> : null}
    </div>
  );
}
