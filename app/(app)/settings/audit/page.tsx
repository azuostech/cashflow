'use client';

import { useMemo, useState } from 'react';
import { Select } from '@/components/ui/select';
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
  { value: 'bank_account', label: 'Conta bancaria' },
  { value: 'cost_center', label: 'Centro de custo' },
  { value: 'category', label: 'Categoria' },
  { value: 'contact', label: 'Contato' }
];

export default function AuditSettingsPage() {
  const [entityType, setEntityType] = useState('');
  const url = useMemo(() => `/api/audit-logs?limit=100${entityType ? `&entityType=${entityType}` : ''}`, [entityType]);
  const { data: logs } = useFetch<AuditLog[]>(url);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Auditoria</h1>
          <p className="mt-1 text-sm text-gray-500">Ultimas operacoes criticas registradas para a empresa ativa.</p>
        </div>
        <Select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="w-56">
          {ENTITY_TYPES.map((entity) => (
            <option key={entity.value} value={entity.value}>
              {entity.label}
            </option>
          ))}
        </Select>
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
