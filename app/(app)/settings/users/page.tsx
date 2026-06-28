'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Copy, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFetch } from '@/hooks/use-fetch';
import {
  AppUserRole,
  ROLE_LABELS,
  USER_ROLES,
  canChangeRole,
  canInviteUser,
  canRemoveUser,
  isUserRole
} from '@/lib/users/permissions';
import { cn } from '@/lib/utils/cn';

interface MeResponse {
  user: {
    id: string;
  };
  activeCompanyId: string;
  activeRole: AppUserRole;
}

interface Member {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: AppUserRole;
  active: boolean;
  status: 'active' | 'pending' | 'inactive';
  invitedAt: string | null;
  inviteAcceptedAt: string | null;
  lastLoginAt: string | null;
  invitedBy: { name: string; email: string } | null;
}

function StatusBadge({ status }: { status: Member['status'] }) {
  const labels = {
    active: 'Ativo',
    pending: 'Pendente',
    inactive: 'Inativo'
  };

  const colors = {
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-yellow-50 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-500'
  };

  return <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', colors[status])}>{labels[status]}</span>;
}

async function readResponseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  if (typeof data?.error === 'string') return data.error;
  if (data?.error) return JSON.stringify(data.error);
  return `HTTP ${response.status}`;
}

export default function UsersSettingsPage() {
  const { data: me } = useFetch<MeResponse>('/api/users/me');
  const usersUrl = me ? `/api/companies/${me.activeCompanyId}/users` : null;
  const { data: members, loading, error, refetch } = useFetch<Member[]>(usersUrl);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppUserRole>('financial');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');

  const actorRole = isUserRole(me?.activeRole) ? me.activeRole : 'viewer';
  const roleOptions = USER_ROLES.filter((candidate) => canInviteUser(actorRole, candidate));
  const activeOwnerCount = useMemo(
    () => members?.filter((member) => member.role === 'owner' && member.active && member.inviteAcceptedAt).length ?? 0,
    [members]
  );

  async function inviteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!me) return;

    setSubmitting(true);
    setActionError('');
    setActionMessage('');
    setLastInviteUrl('');

    const response = await fetch(`/api/companies/${me.activeCompanyId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      setActionError(await readResponseError(response));
      setSubmitting(false);
      return;
    }

    const data = (await response.json()) as { inviteUrl: string; deliveryStatus: string };
    setEmail('');
    setLastInviteUrl(data.inviteUrl);
    setActionMessage(
      data.deliveryStatus === 'sent'
        ? 'Convite enviado.'
        : 'Convite registrado. Use o link manual se o email nao chegar.'
    );
    await refetch();
    setSubmitting(false);
  }

  async function updateRole(member: Member, nextRole: AppUserRole) {
    if (!me || nextRole === member.role) return;

    setActionError('');
    setActionMessage('');
    const response = await fetch(`/api/companies/${me.activeCompanyId}/users/${member.userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole })
    });

    if (!response.ok) {
      setActionError(await readResponseError(response));
      return;
    }

    setActionMessage('Papel atualizado.');
    await refetch();
  }

  async function removeUser(member: Member) {
    if (!me) return;

    const verb = member.status === 'pending' ? 'cancelar este convite' : 'remover este acesso';
    if (!window.confirm(`Deseja ${verb}?`)) return;

    setActionError('');
    setActionMessage('');
    const response = await fetch(`/api/companies/${me.activeCompanyId}/users/${member.userId}`, { method: 'DELETE' });

    if (!response.ok) {
      setActionError(await readResponseError(response));
      return;
    }

    setActionMessage(member.status === 'pending' ? 'Convite cancelado.' : 'Acesso removido.');
    await refetch();
  }

  async function copyInviteUrl() {
    if (!lastInviteUrl) return;
    await navigator.clipboard?.writeText(lastInviteUrl);
    setActionMessage('Link copiado.');
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
          <p className="mt-1 text-sm text-gray-500">Membros, convites e papeis da empresa ativa.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()} disabled={!usersUrl || loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <form onSubmit={(event) => void inviteUser(event)} className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_auto]">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@empresa.com"
            required
          />
          <Select value={role} onChange={(event) => setRole(event.target.value as AppUserRole)} disabled={!roleOptions.length}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={!me || submitting || !roleOptions.length}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar
          </Button>
        </div>

        {actionError ? <p className="mt-3 text-sm font-medium text-red-600">{actionError}</p> : null}
        {actionMessage ? <p className="mt-3 text-sm font-medium text-emerald-700">{actionMessage}</p> : null}
        {lastInviteUrl ? (
          <div className="mt-3 flex flex-col gap-2 rounded-md bg-gray-50 p-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate text-xs text-gray-600">{lastInviteUrl}</code>
            <Button type="button" variant="outline" className="h-8 px-3" onClick={() => void copyInviteUrl()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
          </div>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Usuario</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Convite</TableHead>
              <TableHead className="w-28 text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-red-600">
                  {error}
                </TableCell>
              </TableRow>
            ) : null}
            {!error && !members?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-400">
                  Nenhum usuario encontrado
                </TableCell>
              </TableRow>
            ) : null}
            {members?.map((member) => {
              const isLastOwner = member.role === 'owner' && member.active && Boolean(member.inviteAcceptedAt) && activeOwnerCount <= 1;
              const canEditRole = canChangeRole(actorRole, member.role, member.role, { isLastOwner });
              const canRemove =
                canRemoveUser(actorRole, member.role, { isLastOwner }) && Boolean(me?.activeCompanyId) && member.userId !== me?.user.id;
              const availableRoles = USER_ROLES.filter((candidate) =>
                canChangeRole(actorRole, member.role, candidate, { isLastOwner })
              );

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{member.name || member.email}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onChange={(event) => void updateRole(member, event.target.value as AppUserRole)}
                      disabled={!canEditRole || availableRoles.length <= 1}
                      className="h-9 w-44"
                    >
                      {availableRoles.map((option) => (
                        <option key={option} value={option}>
                          {ROLE_LABELS[option]}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.status} />
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {member.inviteAcceptedAt ? (
                      <span>{new Date(member.inviteAcceptedAt).toLocaleDateString('pt-BR')}</span>
                    ) : member.invitedAt ? (
                      <span>Pendente desde {new Date(member.invitedAt).toLocaleDateString('pt-BR')}</span>
                    ) : (
                      <span>--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-red-600 hover:bg-red-50"
                      disabled={!canRemove}
                      aria-label="Remover usuario"
                      onClick={() => void removeUser(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
