'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatCNPJ } from '@/lib/utils/validators';

type UserRole = 'admin' | 'consultor' | 'cliente';

interface Company {
  id: string;
  name: string;
  cnpj: string;
}

interface SessionContextPayload {
  user: {
    role: UserRole;
  };
  activeCompanyId: string | null;
  canAccessMultipleCompanies: boolean;
  companies: Company[];
}

export default function EmpresasPage() {
  const router = useRouter();
  const [context, setContext] = useState<SessionContextPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');

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

  async function accessCompany(companyId: string) {
    setSwitchingId(companyId);
    setError(null);

    const response = await fetch('/api/session/active-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error ?? 'Nao foi possivel entrar no dashboard da empresa.');
      setSwitchingId(null);
      return;
    }

    setSwitchingId(null);
    router.push('/dashboard');
    router.refresh();
  }

  async function createCompany() {
    const name = newCompanyName.trim();
    const cnpj = formatCNPJ(newCompanyCnpj);

    if (!name || !cnpj) return;

    setCreatingCompany(true);
    setCreateError(null);
    setCreateSuccess(null);

    const response = await fetch('/api/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cnpj })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setCreateError(payload.error ?? 'Nao foi possivel criar a empresa.');
      setCreatingCompany(false);
      return;
    }

    setNewCompanyName('');
    setNewCompanyCnpj('');
    setCreateSuccess('Empresa criada com sucesso.');
    setCreatingCompany(false);
    await loadContext();
  }

  const role = context?.user.role;
  const isClientRole = role === 'cliente';
  const isAdmin = role === 'admin';

  return (
    <section>
      <Header title="Empresas" subtitle="Visualize empresas disponiveis e abra o dashboard no contexto correto." />

      {loading ? <p className="text-sm text-app-subtle">Carregando empresas...</p> : null}

      {!loading && !context ? (
        <Card>
          <p className="text-sm text-danger">Nao foi possivel carregar os dados da sessao.</p>
        </Card>
      ) : null}

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">{error}</p> : null}

      {isAdmin ? (
        <Card className="mb-6 max-w-3xl">
          <h2 className="mb-3 text-lg font-semibold">Criar nova empresa</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input
              placeholder="Nome da empresa"
              value={newCompanyName}
              onChange={(event) => setNewCompanyName(event.target.value)}
              className="md:col-span-2"
            />
            <Input
              placeholder="CNPJ"
              value={newCompanyCnpj}
              onChange={(event) => setNewCompanyCnpj(formatCNPJ(event.target.value))}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button type="button" disabled={creatingCompany} onClick={createCompany}>
              {creatingCompany ? 'Criando...' : 'Criar empresa'}
            </Button>
          </div>
          {createError ? <p className="mt-3 text-sm text-danger">{createError}</p> : null}
          {createSuccess ? <p className="mt-3 text-sm text-success">{createSuccess}</p> : null}
        </Card>
      ) : null}

      {isClientRole ? (
        <Card className="max-w-2xl">
          <h2 className="mb-2 text-lg font-semibold">Acesso restrito por empresa</h2>
          <p className="mb-4 text-sm text-app-subtle">
            Seu perfil de cliente tem acesso apenas a empresa vinculada ao seu usuario. Para abrir o dashboard, use o menu principal.
          </p>
          <Button type="button" onClick={() => router.push('/dashboard')}>
            Ir para dashboard
          </Button>
        </Card>
      ) : null}

      {!isClientRole && context ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {context.companies.map((company) => {
            const isActive = context.activeCompanyId === company.id;
            const isSwitching = switchingId === company.id;

            return (
              <Card key={company.id}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-xs text-app-subtle">CNPJ: {formatCNPJ(company.cnpj)}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isActive ? 'outline' : 'primary'}
                  disabled={isSwitching}
                  onClick={() => accessCompany(company.id)}
                  className="w-full"
                >
                  {isSwitching ? 'Entrando...' : isActive ? 'Empresa ativa' : 'Entrar no dashboard'}
                </Button>
                {isAdmin ? (
                  <Link href={`/dashboard/empresas/${company.id}/usuarios`}>
                    <Button type="button" variant="ghost" className="mt-2 w-full">
                      Gerenciar usuarios
                    </Button>
                  </Link>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
