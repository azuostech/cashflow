'use client';

import { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TypeBadge } from '@/components/shared/type-badge';
import { useFetch } from '@/hooks/use-fetch';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

const ENTITY_TYPES = [
  { value: '', label: 'Todas entidades' },
  { value: 'company', label: 'Empresa' },
  { value: 'user_company_role', label: 'Usuario' },
  { value: 'bank_account', label: 'Conta bancaria' },
  { value: 'bank_statement', label: 'Extrato bancario' },
  { value: 'bank_move', label: 'Movimento bancario' },
  { value: 'cost_center', label: 'Centro de custo' },
  { value: 'category', label: 'Categoria' },
  { value: 'contact', label: 'Contato' },
  { value: 'transaction', label: 'Lancamento' },
  { value: 'accounting_period', label: 'Periodo contabil' }
];

const ACTIONS = [
  { value: '', label: 'Todas acoes' },
  { value: 'create', label: 'Criacao' },
  { value: 'update', label: 'Atualizacao' },
  { value: 'delete', label: 'Exclusao' },
  { value: 'revoke', label: 'Revogacao' },
  { value: 'import', label: 'Importacao' },
  { value: 'reconcile', label: 'Conciliacao' },
  { value: 'unreconcile', label: 'Desconciliacao' },
  { value: 'cancel', label: 'Cancelamento' },
  { value: 'reverse', label: 'Estorno' },
  { value: 'period_close', label: 'Fechamento' },
  { value: 'period_reopen', label: 'Reabertura' },
  { value: 'period_lock', label: 'Bloqueio' },
  { value: 'period_unlock', label: 'Desbloqueio' }
];

export default function AuditSettingsPage() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query.trim()) params.set('q', query.trim());
    return params.toString();
  }, [action, entityType, from, query, to]);
  const url = useMemo(() => `/api/audit-logs?${queryString}`, [queryString]);
  const { data: logs } = useFetch<AuditLog[]>(url);

  function exportCsv() {
    window.location.href = `/api/audit-logs/export?${queryString}`;
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Auditoria</h1>
          <p className="mt-1 text-sm text-gray-500">Ultimas operacoes criticas registradas para a empresa ativa.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_150px_150px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar usuario, entidade ou ID"
              className="pl-9"
            />
          </label>
          <Select value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            {ENTITY_TYPES.map((entity) => (
              <option key={entity.value} value={entity.value}>
                {entity.label}
              </option>
            ))}
          </Select>
          <Select value={action} onChange={(event) => setAction(event.target.value)}>
            {ACTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Data final" />
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Data</TableHead>
              <TableHead>Acao</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!logs?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-gray-400">
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : null}
            {logs?.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-gray-500">{new Date(log.createdAt).toLocaleString('pt-BR')}</TableCell>
                <TableCell>
                  <TypeBadge type={log.action} />
                </TableCell>
                <TableCell className="text-gray-700">{log.entityType}</TableCell>
                <TableCell className="text-gray-500">{log.user?.name ?? log.user?.email ?? '--'}</TableCell>
                <TableCell className="font-mono text-xs text-gray-400">{log.entityId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
