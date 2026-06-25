'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileText, RefreshCw, UploadCloud } from 'lucide-react';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFetch } from '@/hooks/use-fetch';
import { formatDate } from '@/lib/utils/date';

type ImportStep = 'select' | 'mapping' | 'exchange' | 'confirm' | 'result';

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface UploadResult {
  statementId: string;
  source: string;
  filename: string;
  bankAccountId: string;
  bankProvider: string | null;
  importMapping: {
    id: string;
    name: string;
  } | null;
  detectedColumns: string[];
  needsMapping: boolean;
  needsExchangeRate: boolean;
  accountCurrency: string;
  storageWarning: string | null;
}

interface ProcessResult {
  imported: number;
  duplicates: number;
  errors: number;
  warnings: string[];
  statementId: string;
}

interface StatementHistory {
  id: string;
  filename: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalMoves: number;
  totalDuplicates: number;
  status: string;
  importedAt: string;
  bankAccount?: { id: string; name: string; currency: string } | null;
}

interface InlineMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountSignConvention: 'signed_single' | 'separate_columns' | 'debit_negative';
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  referenceColumn: string;
  dateFormat: string;
  decimalSeparator: string;
  thousandSeparator: string;
  saveMapping: boolean;
  mappingName: string;
}

const INITIAL_MAPPING: InlineMapping = {
  dateColumn: '',
  descriptionColumn: '',
  amountSignConvention: 'signed_single',
  amountColumn: '',
  debitColumn: '',
  creditColumn: '',
  referenceColumn: '',
  dateFormat: 'dd/MM/yyyy',
  decimalSeparator: '.',
  thousandSeparator: '',
  saveMapping: false,
  mappingName: ''
};

function formatApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Erro na importacao.';

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const firstFieldError = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (firstFieldError) return firstFieldError;
  }

  return 'Erro na importacao.';
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

export default function BankStatementImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('select');
  const [bankAccountId, setBankAccountId] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [exchangeRateDate, setExchangeRateDate] = useState(new Date().toISOString().split('T')[0]);
  const [inlineMapping, setInlineMapping] = useState<InlineMapping>(INITIAL_MAPPING);

  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts');
  const { data: statements, refetch: refetchStatements } = useFetch<StatementHistory[]>('/api/bank/statements');
  const selectedAccount = (accounts ?? []).find((account) => account.id === bankAccountId);
  const mappingReady =
    !!inlineMapping.dateColumn &&
    !!inlineMapping.descriptionColumn &&
    (inlineMapping.amountSignConvention === 'separate_columns'
      ? !!inlineMapping.creditColumn || !!inlineMapping.debitColumn
      : !!inlineMapping.amountColumn);

  async function handleFile(file: File) {
    if (!bankAccountId) {
      setError('Selecione uma conta bancaria antes de enviar o arquivo.');
      return;
    }

    setError('');
    setUploading(true);

    const form = new FormData();
    form.append('file', file);
    form.append('bankAccountId', bankAccountId);

    const response = await fetch('/api/bank/statements/upload', { method: 'POST', body: form });
    setUploading(false);

    const data = await response.json().catch(() => ({}));
    if (response.status === 409) {
      setError(`Este arquivo ja foi importado em ${data.importedAt ? formatDate(data.importedAt) : 'data anterior'}.`);
      return;
    }

    if (!response.ok) {
      setError(formatApiError(data));
      return;
    }

    setUploadResult(data as UploadResult);
    if (data.needsMapping) setStep('mapping');
    else if (data.needsExchangeRate) setStep('exchange');
    else setStep('confirm');
  }

  async function handleProcess() {
    if (!uploadResult?.statementId) return;

    setProcessing(true);
    setError('');

    const payload: Record<string, unknown> = {};
    if (uploadResult.needsExchangeRate) {
      payload.exchangeRate = Number(exchangeRate);
      payload.exchangeRateDate = exchangeRateDate;
    }

    if (uploadResult.needsMapping) {
      payload.inlineMapping = {
        ...inlineMapping,
        amountColumn: inlineMapping.amountColumn || null,
        debitColumn: inlineMapping.debitColumn || null,
        creditColumn: inlineMapping.creditColumn || null,
        referenceColumn: inlineMapping.referenceColumn || null,
        thousandSeparator: inlineMapping.thousandSeparator || null
      };
    } else if (uploadResult.importMapping?.id) {
      payload.importMappingId = uploadResult.importMapping.id;
    }

    const response = await fetch(`/api/bank/statements/${uploadResult.statementId}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setProcessing(false);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(formatApiError(data));
      return;
    }

    setProcessResult(data as ProcessResult);
    setStep('result');
    await refetchStatements();
  }

  function reset() {
    setStep('select');
    setUploadResult(null);
    setProcessResult(null);
    setError('');
    setBankAccountId('');
    setExchangeRate('');
    setInlineMapping(INITIAL_MAPPING);
    if (inputRef.current) inputRef.current.value = '';
  }

  function previousFromConfirm(): ImportStep {
    if (uploadResult?.needsExchangeRate) return 'exchange';
    if (uploadResult?.needsMapping) return 'mapping';
    return 'select';
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Importar extrato</h1>
          <p className="mt-1 text-sm text-gray-500">OFX, CSV e XLSX com deduplicacao por SHA-256.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => router.push('/bank/statements')} className="gap-2">
          <FileText className="h-4 w-4" />
          Historico
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {uploadResult?.storageWarning ? (
        <div className="mb-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Storage retornou: {uploadResult.storageWarning}</span>
        </div>
      ) : null}

      {step === 'select' ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <FormField id="bankAccountId" label="Conta bancaria" required>
            <Select id="bankAccountId" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
              <option value="">Selecionar conta</option>
              {(accounts ?? [])
                .filter((account) => account.active)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </option>
                ))}
            </Select>
          </FormField>

          <button
            type="button"
            className={[
              'mt-5 flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition',
              dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
            ].join(' ')}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".ofx,.csv,.xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <UploadCloud className="mb-3 h-8 w-8 text-gray-300" />
            <span className="text-sm font-medium text-gray-700">
              {uploading ? 'Enviando...' : 'Arraste o arquivo ou clique para selecionar'}
            </span>
            <span className="mt-1 text-xs text-gray-400">.ofx, .csv, .xlsx, max. 50 MB</span>
          </button>
        </section>
      ) : null}

      {step === 'mapping' && uploadResult ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Mapeamento de colunas</h2>
          <p className="mt-1 text-sm text-gray-500">
            {uploadResult.filename} - {uploadResult.detectedColumns.length} colunas detectadas
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ColumnSelect
              id="dateColumn"
              label="Coluna de data"
              value={inlineMapping.dateColumn}
              columns={uploadResult.detectedColumns}
              required
              onChange={(value) => setInlineMapping((current) => ({ ...current, dateColumn: value }))}
            />
            <ColumnSelect
              id="descriptionColumn"
              label="Coluna de descricao"
              value={inlineMapping.descriptionColumn}
              columns={uploadResult.detectedColumns}
              required
              onChange={(value) => setInlineMapping((current) => ({ ...current, descriptionColumn: value }))}
            />
            <FormField id="amountSignConvention" label="Convencao de valor" required>
              <Select
                id="amountSignConvention"
                value={inlineMapping.amountSignConvention}
                onChange={(event) =>
                  setInlineMapping((current) => ({
                    ...current,
                    amountSignConvention: event.target.value as InlineMapping['amountSignConvention']
                  }))
                }
              >
                <option value="signed_single">Uma coluna com sinal</option>
                <option value="separate_columns">Colunas separadas</option>
                <option value="debit_negative">Negativo como debito</option>
              </Select>
            </FormField>

            {inlineMapping.amountSignConvention === 'separate_columns' ? (
              <>
                <ColumnSelect
                  id="creditColumn"
                  label="Coluna de entrada"
                  value={inlineMapping.creditColumn}
                  columns={uploadResult.detectedColumns}
                  onChange={(value) => setInlineMapping((current) => ({ ...current, creditColumn: value }))}
                />
                <ColumnSelect
                  id="debitColumn"
                  label="Coluna de saida"
                  value={inlineMapping.debitColumn}
                  columns={uploadResult.detectedColumns}
                  onChange={(value) => setInlineMapping((current) => ({ ...current, debitColumn: value }))}
                />
              </>
            ) : (
              <ColumnSelect
                id="amountColumn"
                label="Coluna de valor"
                value={inlineMapping.amountColumn}
                columns={uploadResult.detectedColumns}
                required
                onChange={(value) => setInlineMapping((current) => ({ ...current, amountColumn: value }))}
              />
            )}

            <ColumnSelect
              id="referenceColumn"
              label="Coluna de referencia"
              value={inlineMapping.referenceColumn}
              columns={uploadResult.detectedColumns}
              onChange={(value) => setInlineMapping((current) => ({ ...current, referenceColumn: value }))}
            />
            <FormField id="dateFormat" label="Formato da data">
              <Select
                id="dateFormat"
                value={inlineMapping.dateFormat}
                onChange={(event) => setInlineMapping((current) => ({ ...current, dateFormat: event.target.value }))}
              >
                <option value="dd/MM/yyyy">DD/MM/AAAA</option>
                <option value="MM/dd/yyyy">MM/DD/AAAA</option>
                <option value="yyyy-MM-dd">AAAA-MM-DD</option>
              </Select>
            </FormField>
            <FormField id="decimalSeparator" label="Separador decimal">
              <Select
                id="decimalSeparator"
                value={inlineMapping.decimalSeparator}
                onChange={(event) => setInlineMapping((current) => ({ ...current, decimalSeparator: event.target.value }))}
              >
                <option value=".">Ponto</option>
                <option value=",">Virgula</option>
              </Select>
            </FormField>
            <FormField id="thousandSeparator" label="Separador de milhar">
              <Select
                id="thousandSeparator"
                value={inlineMapping.thousandSeparator}
                onChange={(event) => setInlineMapping((current) => ({ ...current, thousandSeparator: event.target.value }))}
              >
                <option value="">Nenhum</option>
                <option value=".">Ponto</option>
                <option value=",">Virgula</option>
              </Select>
            </FormField>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={inlineMapping.saveMapping}
                onChange={(event) => setInlineMapping((current) => ({ ...current, saveMapping: event.target.checked }))}
              />
              Salvar mapeamento para esta empresa
            </label>
            {inlineMapping.saveMapping ? (
              <Input
                className="mt-3"
                placeholder="Nome do mapeamento"
                value={inlineMapping.mappingName}
                onChange={(event) => setInlineMapping((current) => ({ ...current, mappingName: event.target.value }))}
              />
            ) : null}
          </div>

          <div className="mt-5 flex justify-between">
            <Button type="button" variant="ghost" onClick={reset} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!mappingReady}
              onClick={() => setStep(uploadResult.needsExchangeRate ? 'exchange' : 'confirm')}
              className="gap-2"
            >
              Proximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'exchange' && uploadResult ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Taxa de cambio</h2>
          <p className="mt-1 text-sm text-gray-500">
            Conta {selectedAccount?.name ?? ''} em {uploadResult.accountCurrency}.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <FormField id="exchangeRate" label={`1 ${uploadResult.accountCurrency} em BRL`} required>
              <Input
                id="exchangeRate"
                type="number"
                min="0"
                step="0.0001"
                value={exchangeRate}
                onChange={(event) => setExchangeRate(event.target.value)}
              />
            </FormField>
            <FormField id="exchangeRateDate" label="Data da taxa">
              <Input id="exchangeRateDate" type="date" value={exchangeRateDate} onChange={(event) => setExchangeRateDate(event.target.value)} />
            </FormField>
          </div>
          <div className="mt-5 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(uploadResult.needsMapping ? 'mapping' : 'select')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button type="button" disabled={!exchangeRate} onClick={() => setStep('confirm')} className="gap-2">
              Proximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'confirm' && uploadResult ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Confirmar importacao</h2>
          {uploadResult.importMapping ? (
            <div className="mt-4 flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>Mapeamento {uploadResult.importMapping.name} sera usado automaticamente.</span>
            </div>
          ) : null}
          <dl className="mt-4 divide-y divide-gray-100 rounded-md bg-gray-50 px-4 text-sm">
            <InfoRow label="Arquivo" value={uploadResult.filename} />
            <InfoRow label="Conta" value={selectedAccount?.name ?? '--'} />
            <InfoRow label="Banco" value={uploadResult.bankProvider ?? '--'} />
            <InfoRow label="Formato" value={uploadResult.source.replace('file_', '').toUpperCase()} />
            {exchangeRate ? <InfoRow label="Cambio" value={`1 ${uploadResult.accountCurrency} = BRL ${exchangeRate}`} /> : null}
          </dl>
          <div className="mt-5 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(previousFromConfirm())} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button type="button" disabled={processing || !!uploadResult.storageWarning} onClick={() => void handleProcess()} className="gap-2">
              {processing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {processing ? 'Processando...' : 'Confirmar importacao'}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'result' && processResult ? (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Importacao concluida</h2>
              <p className="text-sm text-gray-500">Extrato processado e movimentos criados.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Importados" value={processResult.imported} className="text-emerald-600" />
            <Metric label="Duplicatas" value={processResult.duplicates} className="text-amber-600" />
            <Metric label="Erros" value={processResult.errors} className="text-red-600" />
          </div>
          {processResult.warnings.length > 0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {processResult.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Importar outro
            </Button>
            <Button type="button" onClick={() => router.push('/bank/reconciliation')} className="gap-2">
              Ir para conciliacao
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'select' && (statements ?? []).length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Historico de importacoes</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Arquivo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Conta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Periodo</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Movimentos</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(statements ?? []).slice(0, 8).map((statement) => (
                    <tr key={statement.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-xs font-medium text-gray-800">{statement.filename ?? '--'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{statement.bankAccount?.name ?? '--'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {statement.periodStart ? formatDate(statement.periodStart) : '--'}
                        {statement.periodEnd && statement.periodEnd !== statement.periodStart ? ` - ${formatDate(statement.periodEnd)}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-gray-700">{statement.totalMoves}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(statement.status)}`}>
                          {statusLabel(statement.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ColumnSelect({
  id,
  label,
  value,
  columns,
  required,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  columns: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormField id={id} label={label} required={required}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecionar</option>
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="truncate text-right font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-4">
      <p className={`text-2xl font-semibold ${className}`}>{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
