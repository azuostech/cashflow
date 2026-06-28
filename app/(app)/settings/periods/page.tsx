'use client';

import { useState } from 'react';
import { CheckCircle2, Download, LockKeyhole, RefreshCw, RotateCcw, UnlockKeyhole } from 'lucide-react';
import { PreCloseModal } from '@/components/periods/pre-close-modal';
import { ReopenModal } from '@/components/periods/reopen-modal';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';

type PeriodStatus = 'open' | 'closed' | 'locked';

interface PeriodItem {
  year: number;
  month: number;
  label: string;
  status: PeriodStatus;
  canClose: boolean;
  canReopen: boolean;
  canLock: boolean;
  canUnlock: boolean;
  period: {
    id: string;
    closedAt: string | null;
    dreSnapshot: unknown | null;
    closedBy?: { name: string; email: string } | null;
    reopenedBy?: { name: string; email: string } | null;
  } | null;
}

const STATUS_CONFIG: Record<PeriodStatus, { label: string; dot: string; text: string; bg: string }> = {
  open: { label: 'Aberto', dot: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  closed: { label: 'Fechado', dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50' },
  locked: { label: 'Bloqueado', dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100' }
};

function formatApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Erro ao executar acao.';

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (firstFieldError) return firstFieldError;
  }

  return 'Erro ao executar acao.';
}

export default function PeriodsSettingsPage() {
  const { data: periods, loading, error, refetch } = useFetch<PeriodItem[]>('/api/periods?limit=24');
  const [closeModal, setCloseModal] = useState<PeriodItem | null>(null);
  const [reopenModal, setReopenModal] = useState<{ period: PeriodItem; mode: 'reopen' | 'unlock' } | null>(null);
  const [actionError, setActionError] = useState('');
  const [actionId, setActionId] = useState('');
  const list = periods ?? [];

  async function requestPeriodAction(period: PeriodItem, endpoint: string, body?: Record<string, unknown>) {
    setActionError('');
    setActionId(`${period.year}-${period.month}-${endpoint}`);

    const response = await fetch(`/api/periods/${period.year}/${period.month}/${endpoint}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));

    setActionId('');

    if (!response.ok) {
      setActionError(formatApiError(data));
      return false;
    }

    await refetch();
    return true;
  }

  async function handleClose(period: PeriodItem, notes?: string) {
    const ok = await requestPeriodAction(period, 'close', { notes });
    if (ok) setCloseModal(null);
  }

  async function handleReopen(period: PeriodItem, justification: string, mode: 'reopen' | 'unlock') {
    const ok = await requestPeriodAction(period, mode, { justification });
    if (ok) setReopenModal(null);
  }

  async function handleLock(period: PeriodItem) {
    if (!window.confirm(`Bloquear ${period.label}? Apenas o owner podera desbloquear depois.`)) return;
    await requestPeriodAction(period, 'lock');
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Fechamento Mensal</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie o fechamento dos periodos contabeis e seus snapshots.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {actionError ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actionError}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Periodo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Fechado por</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Fechado em</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    Carregando periodos...
                  </td>
                </tr>
              ) : null}

              {!loading && list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                    Nenhum periodo encontrado.
                  </td>
                </tr>
              ) : null}

              {!loading
                ? list.map((period) => {
                    const config = STATUS_CONFIG[period.status] ?? STATUS_CONFIG.open;
                    const currentActionPrefix = `${period.year}-${period.month}`;
                    const busy = actionId.startsWith(currentActionPrefix);

                    return (
                      <tr key={`${period.year}-${period.month}`} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium capitalize text-gray-800">{period.label}</p>
                          <p className="text-xs text-gray-400">
                            {period.year}/{String(period.month).padStart(2, '0')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-xs font-medium', config.bg, config.text)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{period.period?.closedBy?.name ?? '--'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {period.period?.closedAt ? formatDate(period.period.closedAt) : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {period.canClose ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setCloseModal(period)}
                                className="h-8 gap-1.5 px-3 text-xs"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Fechar
                              </Button>
                            ) : null}

                            {period.canReopen ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReopenModal({ period, mode: 'reopen' })}
                                className="h-8 gap-1.5 border-amber-200 px-3 text-xs text-amber-700 hover:bg-amber-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reabrir
                              </Button>
                            ) : null}

                            {period.canLock ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void handleLock(period)}
                                className="h-8 gap-1.5 px-3 text-xs text-gray-600"
                              >
                                <LockKeyhole className="h-3.5 w-3.5" />
                                Bloquear
                              </Button>
                            ) : null}

                            {period.canUnlock ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReopenModal({ period, mode: 'unlock' })}
                                className="h-8 gap-1.5 px-3 text-xs text-gray-600"
                              >
                                <UnlockKeyhole className="h-3.5 w-3.5" />
                                Desbloquear
                              </Button>
                            ) : null}

                            {period.period?.dreSnapshot ? (
                              <Button
                                type="button"
                                variant="ghost"
                                disabled
                                title="Snapshot gerado no fechamento"
                                className="h-8 gap-1.5 px-3 text-xs text-gray-400"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Snapshot
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-xs text-gray-400">
        <p>
          <strong>Aberto:</strong> periodo livre para ajustes conforme permissoes do usuario.
        </p>
        <p>
          <strong>Fechado:</strong> alteracoes retroativas exigem justificativa e permissao administrativa.
        </p>
        <p>
          <strong>Bloqueado:</strong> alteracoes retroativas ficam bloqueadas ate desbloqueio pelo owner.
        </p>
      </div>

      {closeModal ? (
        <PreCloseModal
          year={closeModal.year}
          month={closeModal.month}
          label={closeModal.label}
          open={Boolean(closeModal)}
          onClose={() => setCloseModal(null)}
          onConfirm={(notes) => handleClose(closeModal, notes)}
        />
      ) : null}

      {reopenModal ? (
        <ReopenModal
          year={reopenModal.period.year}
          month={reopenModal.period.month}
          label={reopenModal.period.label}
          mode={reopenModal.mode}
          open={Boolean(reopenModal)}
          onClose={() => setReopenModal(null)}
          onConfirm={(justification) => handleReopen(reopenModal.period, justification, reopenModal.mode)}
        />
      ) : null}
    </div>
  );
}
