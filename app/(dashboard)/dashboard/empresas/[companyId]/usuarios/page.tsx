'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface Company {
  id: string;
  name: string;
  cnpj: string;
}

interface CompanyUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'consultor' | 'cliente';
  created_at: string | null;
  last_login: string | null;
}

interface Payload {
  company: Company;
  users: CompanyUser[];
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Nunca';
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

export default function EmpresaUsuariosPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function loadUsers() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/companies/${companyId}/users`, {
      cache: 'no-store'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? 'Falha ao carregar usuarios da empresa.');
      setPayload(null);
      setLoading(false);
      return;
    }

    setPayload(data);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers().catch(() => {
      setError('Falha ao carregar usuarios da empresa.');
      setPayload(null);
      setLoading(false);
    });
  }, [companyId]);

  async function createUser() {
    if (!fullName.trim() || !email.trim() || !password.trim()) return;
    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }

    setCreating(true);
    setError(null);

    const response = await fetch(`/api/admin/companies/${companyId}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
        password
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? 'Falha ao criar usuario.');
      setCreating(false);
      return;
    }

    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setCreating(false);
    await loadUsers();
  }

  async function updateUserName(user: CompanyUser) {
    const nextName = window.prompt('Informe o novo nome do usuario:', user.full_name ?? '');
    if (!nextName || nextName.trim().length < 2) return;

    setActionUserId(user.id);
    setError(null);

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: nextName.trim() })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? 'Falha ao atualizar nome do usuario.');
      setActionUserId(null);
      return;
    }

    setActionUserId(null);
    await loadUsers();
  }

  async function resetUserPassword(user: CompanyUser) {
    const nextPassword = window.prompt(`Nova senha para ${user.email}:`);
    if (!nextPassword || nextPassword.length < 6) return;

    setActionUserId(user.id);
    setError(null);

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: nextPassword })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? 'Falha ao redefinir senha.');
      setActionUserId(null);
      return;
    }

    setActionUserId(null);
  }

  async function deleteUser(user: CompanyUser) {
    const confirmed = window.confirm(`Deseja excluir o usuario ${user.email}?`);
    if (!confirmed) return;

    setActionUserId(user.id);
    setError(null);

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE'
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? 'Falha ao excluir usuario.');
      setActionUserId(null);
      return;
    }

    setActionUserId(null);
    await loadUsers();
  }

  const users = useMemo(() => payload?.users ?? [], [payload]);

  return (
    <section>
      <Header title="Usuarios da empresa" subtitle="Controle os usuarios associados a esta empresa." />

      <div className="mb-4">
        <Link href="/dashboard/empresas">
          <Button type="button" variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para empresas
          </Button>
        </Link>
      </div>

      {loading ? <p className="text-sm text-app-subtle">Carregando...</p> : null}
      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger">{error}</p> : null}

      {payload ? (
        <Card className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{payload.company.name}</h2>
          </div>
          <p className="text-sm text-app-subtle">CNPJ: {payload.company.cnpj}</p>
        </Card>
      ) : null}

      <Card className="mb-6">
        <h3 className="mb-3 text-lg font-semibold">Novo usuario da empresa</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input placeholder="Nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input placeholder="Senha provisoria" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <Input
            placeholder="Confirmar senha"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <div className="mt-3">
          <Button type="button" disabled={creating} onClick={createUser}>
            {creating ? 'Criando usuario...' : 'Criar usuario'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-semibold">Usuarios associados</h3>
        <div className="space-y-3">
          {users.map((user) => {
            const isActing = actionUserId === user.id;
            return (
              <div key={user.id} className="rounded-lg border border-app-border p-4">
                <div className="mb-2">
                  <p className="font-semibold">{user.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-app-subtle">{user.email}</p>
                  <p className="text-xs text-app-subtle">
                    Criado em: {formatDateTime(user.created_at)} • Ultimo acesso: {formatDateTime(user.last_login)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={isActing} onClick={() => updateUserName(user)}>
                    Alterar nome
                  </Button>
                  <Button type="button" variant="secondary" disabled={isActing} onClick={() => resetUserPassword(user)}>
                    Redefinir senha
                  </Button>
                  <Button type="button" variant="danger" disabled={isActing} onClick={() => deleteUser(user)}>
                    {isActing ? 'Processando...' : 'Excluir usuario'}
                  </Button>
                </div>
              </div>
            );
          })}
          {users.length === 0 ? <p className="text-sm text-app-subtle">Nenhum usuario associado a esta empresa.</p> : null}
        </div>
      </Card>
    </section>
  );
}
