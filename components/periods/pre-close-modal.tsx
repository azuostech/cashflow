'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/shared/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/utils/currency';

interface PreCloseModalProps {
  year: number;
  month: number;
  label: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (notes?: string) => Promise<void> | void;
}

interface PreCloseSummary {
  dreExecutive?: {
    received: number;
    spent: number;
    result: number;
    margin: number;
  };
  unreconciledMoves: number;
  incompleteTransactions: number;
  pendingTransactions: number;
  highlights: Array<{
    label: string;
    value: number | null;
    percent: number | null;
  }>;
  warnings: string[];
}

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function PreCloseModal({ year, month, label, open, onClose, onConfirm }: PreCloseModalProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PreCloseSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    let ignore = false;
    setSummary(null);
    setNotes('');
    setError('');

    fetch(`/api/periods/${year}/${month}/pre-close-summary`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Erro ao carregar resumo.');
        return data as PreCloseSummary;
      })
      .then((data) => {
        if (!ignore) setSummary(data);
      })
      .catch((cause) => {
        if (!ignore) setError(cause instanceof Error ? cause.message : 'Erro ao carregar resumo.');
      });

    return () => {
      ignore = true;
    };
  }, [open, year, month]);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm(notes.trim() || undefined);
    } finally {
      setLoading(false);
    }
  }

  const executive = summary?.dreExecutive;

  return (
    <Modal open={open} onClose={onClose} title={`Fechar ${label}`} size="lg">
      {!summary && !error ? (
        <div className="py-12 text-center">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-gray-400">Calculando resumo do periodo...</p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="space-y-5">
          {executive ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <PeriodKpi label="Receita" value={executive.received} className="text-emerald-600" />
              <PeriodKpi label="Despesas" value={executive.spent} className="text-red-600" />
              <PeriodKpi
                label="Resultado"
                value={executive.result}
                className={executive.result >= 0 ? 'text-emerald-600' : 'text-red-600'}
              />
            </div>
          ) : null}

          {summary.highlights.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Destaques do mes</h3>
              <div className="space-y-2">
                {summary.highlights.map((highlight, index) => (
                  <div key={`${highlight.label}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600">{highlight.label}</span>
                    {highlight.percent !== null ? (
                      <span className={highlight.percent >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
                        {formatPercent(highlight.percent)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {summary.warnings.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Atencao
              </div>
              {summary.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Nenhuma pendencia critica encontrada.
            </div>
          )}

          <div className="rounded-md bg-gray-50 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Pendencias</h3>
            <PendingRow label="Movimentos nao conciliados" value={summary.unreconciledMoves} />
            <PendingRow label="Lancamentos sem categoria" value={summary.incompleteTransactions} />
            <PendingRow label="Lancamentos pendentes de pagamento" value={summary.pendingTransactions} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="period-close-notes">
              Observacao
            </label>
            <Textarea
              id="period-close-notes"
              className="min-h-20 resize-none"
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex: Fechamento revisado e aprovado."
            />
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={loading} onClick={() => void handleConfirm()} className="gap-2">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {loading ? 'Fechando...' : 'Confirmar fechamento'}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function PeriodKpi({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-3 text-center">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-base font-semibold ${className}`}>{formatCurrency(value)}</p>
    </div>
  );
}

function PendingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={value > 0 ? 'font-medium text-amber-600' : 'font-medium text-gray-400'}>{value}</span>
    </div>
  );
}
