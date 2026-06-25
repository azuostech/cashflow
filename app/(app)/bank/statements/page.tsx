'use client';

import Link from 'next/link';
import { FileText, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { formatDate } from '@/lib/utils/date';

interface StatementHistory {
  id: string;
  filename: string | null;
  source: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalMoves: number;
  totalDuplicates: number;
  totalErrors: number;
  status: string;
  importedAt: string;
  errorMessage: string | null;
  bankAccount?: { id: string; name: string; currency: string } | null;
  importMapping?: { id: string; name: string } | null;
  _count?: { bankMoves: number };
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Concluido';
  if (status === 'processing') return 'Processando';
  if (status === 'pending') return 'Pendente';
  if (status === 'error') return 'Erro';
  if (status === 'storage_error') return 'Storage';
  return status;
}

function statusClass(status: string): string {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700';
  if (status === 'processing') return 'bg-blue-50 text-blue-700';
  if (status === 'error' || status === 'storage_error') return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-500';
}

export default function BankStatementsPage() {
  const { data: statements, loading, error, refetch } = useFetch<StatementHistory[]>('/api/bank/statements?limit=100');
  const list = statements ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Extratos bancarios</h1>
          <p className="mt-1 text-sm text-gray-500">Arquivos importados e movimentos criados para conciliacao.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Link
            href="/bank/statements/import"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Importar
          </Link>
        </div>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Arquivo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Conta</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Periodo</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Movimentos</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Duplicatas</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Mapeamento</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    Carregando extratos...
                  </td>
                </tr>
              ) : null}
              {!loading && list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-700">Nenhum extrato importado</p>
                    <p className="mt-1 text-xs text-gray-400">Use a importacao para criar movimentos bancarios.</p>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? list.map((statement) => (
                    <tr key={statement.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="max-w-xs truncate text-xs font-medium text-gray-800">{statement.filename ?? '--'}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{formatDate(statement.importedAt)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {statement.bankAccount?.name ?? '--'}
                        {statement.bankAccount?.currency ? <span className="ml-1 text-gray-300">({statement.bankAccount.currency})</span> : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {statement.periodStart ? formatDate(statement.periodStart) : '--'}
                        {statement.periodEnd && statement.periodEnd !== statement.periodStart ? ` - ${formatDate(statement.periodEnd)}` : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-gray-800">{statement.totalMoves}</td>
                      <td className="px-4 py-3 text-right text-xs text-amber-600">{statement.totalDuplicates}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{statement.importMapping?.name ?? '--'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(statement.status)}`}>
                          {statusLabel(statement.status)}
                        </span>
                        {statement.errorMessage ? <p className="mt-1 max-w-xs truncate text-xs text-red-500">{statement.errorMessage}</p> : null}
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
