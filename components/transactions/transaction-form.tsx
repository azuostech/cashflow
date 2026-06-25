'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Repeat, Rows3 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { useFetch } from '@/hooks/use-fetch';
import { generateInstallmentPreviews, isCategoryCompatible } from '@/lib/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { createTransactionSchema, type CreateTransactionInput } from '@/lib/validations/transaction.schema';

type TransactionFormValues = z.input<typeof createTransactionSchema>;

interface Category {
  id: string;
  name: string;
  type: string;
  deprecatedAt?: string | null;
  dreNode?: { name: string } | null;
}

interface CostCenter {
  id: string;
  name: string;
  active: boolean;
}

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  active: boolean;
}

interface Contact {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface TransactionFormProps {
  initialData?: any;
  companyBaseCurrency: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

const TYPE_LABELS = {
  revenue: 'Receita',
  expense: 'Despesa',
  transfer: 'Transferencia'
};

const FREQUENCY_LABELS = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' }
];

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function dateOnly(value: string | null | undefined) {
  if (!value) return todayDate();
  return value.split('T')[0];
}

function optionalNumber(value: unknown) {
  return value === '' || value === null || value === undefined ? null : Number(value);
}

function extractApiError(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return 'Erro ao salvar lancamento';

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const formErrors = (error as { formErrors?: string[] }).formErrors;
    if (formErrors?.[0]) return formErrors[0];
    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
    const first = fieldErrors ? Object.values(fieldErrors).flat()[0] : null;
    if (first) return first;
  }

  return 'Erro ao salvar lancamento';
}

export function TransactionForm({ initialData, companyBaseCurrency, onSave, onCancel }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [showInstallment, setShowInstallment] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const today = todayDate();

  const { data: categories } = useFetch<Category[]>('/api/categories?includeDeprecated=true');
  const { data: costCenters } = useFetch<CostCenter[]>('/api/cost-centers?active=all');
  const { data: accounts } = useFetch<BankAccount[]>('/api/bank-accounts?active=all');
  const { data: contacts } = useFetch<Contact[]>('/api/contacts?active=all');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TransactionFormValues, unknown, CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    shouldUnregister: false,
    defaultValues: initialData
      ? {
          type: initialData.type,
          description: initialData.description,
          notes: initialData.notes ?? '',
          originalAmount: Number(initialData.originalAmount),
          originalCurrency: initialData.originalCurrency,
          exchangeRate: Number(initialData.exchangeRate ?? 1),
          exchangeRateDate: dateOnly(initialData.exchangeRateDate),
          competenceDate: dateOnly(initialData.competenceDate),
          dueDate: dateOnly(initialData.dueDate),
          paymentDate: initialData.paymentDate ? dateOnly(initialData.paymentDate) : null,
          status: initialData.status,
          categoryId: initialData.categoryId ?? null,
          costCenterId: initialData.costCenterId ?? null,
          bankAccountId: initialData.bankAccountId ?? null,
          destBankAccountId: initialData.destBankAccountId ?? null,
          contactId: initialData.contactId ?? null,
          isInstallment: false,
          installmentCount: null,
          recurrence: null,
          sourceDocumentNumber: initialData.sourceDocumentNumber ?? '',
          externalReference: initialData.externalReference ?? ''
        }
      : {
          type: 'expense',
          description: '',
          notes: '',
          originalAmount: undefined as unknown as number,
          originalCurrency: companyBaseCurrency as 'BRL' | 'USD',
          exchangeRate: 1,
          exchangeRateDate: today,
          competenceDate: today,
          dueDate: today,
          paymentDate: null,
          status: 'pending',
          categoryId: null,
          costCenterId: null,
          bankAccountId: null,
          destBankAccountId: null,
          contactId: null,
          isInstallment: false,
          installmentCount: null,
          recurrence: {
            frequency: 'monthly',
            interval: 1,
            startDate: today,
            endDate: null,
            occurrencesLimit: null,
            dayOfMonth: null
          },
          sourceDocumentNumber: '',
          externalReference: ''
        }
  });

  const watchedType = watch('type');
  const watchedStatus = watch('status');
  const watchedCurrency = watch('originalCurrency');
  const watchedAmount = Number(watch('originalAmount') ?? 0);
  const watchedRate = Number(watch('exchangeRate') ?? 1);
  const watchedCount = Number(watch('installmentCount') ?? 0);
  const watchedDueDate = watch('dueDate');
  const watchedCompetenceDate = watch('competenceDate');

  const isTransfer = watchedType === 'transfer';
  const isPaid = watchedStatus === 'paid' || watchedStatus === 'received';
  const isForeign = watchedCurrency !== companyBaseCurrency;
  const convertedAmount = watchedAmount * watchedRate;

  useEffect(() => {
    if (watchedStatus !== 'paid' && watchedStatus !== 'received') return;
    setValue('status', watchedType === 'revenue' ? 'received' : 'paid');
  }, [setValue, watchedStatus, watchedType]);

  const filteredCategories = useMemo(() => {
    return (categories ?? []).filter((category) => {
      if (category.deprecatedAt) return false;
      return isCategoryCompatible(category.type, watchedType);
    });
  }, [categories, watchedType]);

  const installmentPreviews = useMemo(() => {
    if (!showInstallment || !watchedCount || !watchedDueDate || !watchedAmount) return [];
    return generateInstallmentPreviews(watchedAmount, watchedCount, new Date(`${watchedDueDate}T00:00:00`), watchedRate || 1);
  }, [showInstallment, watchedAmount, watchedCount, watchedDueDate, watchedRate]);

  const categoryOptions = filteredCategories.map((category) => ({
    value: category.id,
    label: category.name,
    meta: category.dreNode?.name
  }));
  const costCenterOptions = (costCenters ?? [])
    .filter((costCenter) => costCenter.active)
    .map((costCenter) => ({ value: costCenter.id, label: costCenter.name }));
  const accountOptions = (accounts ?? [])
    .filter((account) => account.active)
    .map((account) => ({ value: account.id, label: account.name, meta: account.currency }));
  const contactOptions = (contacts ?? [])
    .filter((contact) => contact.active)
    .map((contact) => ({ value: contact.id, label: contact.name, meta: contact.type }));

  async function onSubmit(data: CreateTransactionInput) {
    setServerError('');

    if (!isTransfer && (!data.categoryId || !data.costCenterId)) {
      setServerError('Categoria e centro de custo sao obrigatorios.');
      return;
    }

    if (isTransfer && (!data.bankAccountId || !data.destBankAccountId)) {
      setServerError('Selecione as contas de origem e destino.');
      return;
    }

    if (isPaid && (!data.paymentDate || !data.bankAccountId)) {
      setServerError('Preencha data de pagamento e conta bancaria.');
      return;
    }

    if (showInstallment && !data.installmentCount) {
      setServerError('Informe o numero de parcelas.');
      return;
    }

    const payload = {
      ...data,
      type: watchedType,
      exchangeRate: isForeign ? data.exchangeRate : 1,
      exchangeRateDate: isForeign ? data.exchangeRateDate : null,
      categoryId: isTransfer ? null : data.categoryId ?? null,
      costCenterId: isTransfer ? null : data.costCenterId ?? null,
      bankAccountId: data.bankAccountId ?? null,
      destBankAccountId: isTransfer ? data.destBankAccountId ?? null : null,
      contactId: data.contactId ?? null,
      paymentDate: isPaid ? data.paymentDate : null,
      isInstallment: !initialData && showInstallment,
      installmentCount: !initialData && showInstallment ? data.installmentCount : null,
      recurrence:
        !initialData && showRecurrence
          ? {
              frequency: data.recurrence?.frequency ?? 'monthly',
              interval: data.recurrence?.interval ?? 1,
              startDate: data.dueDate,
              endDate: data.recurrence?.endDate ?? null,
              occurrencesLimit: data.recurrence?.occurrencesLimit ?? null,
              dayOfMonth: data.recurrence?.dayOfMonth ?? null
            }
          : null,
      notes: data.notes || null,
      sourceDocumentNumber: data.sourceDocumentNumber || null,
      externalReference: data.externalReference || null
    };

    setLoading(true);
    try {
      await onSave(payload);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Erro ao salvar lancamento');
    } finally {
      setLoading(false);
    }
  }

  function changeType(type: 'revenue' | 'expense' | 'transfer') {
    if (initialData) return;
    setValue('type', type);
    setValue('categoryId', null);
    if (watchedStatus === 'paid' || watchedStatus === 'received') {
      setValue('status', type === 'revenue' ? 'received' : 'paid');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-3 overflow-hidden rounded-md border border-gray-200">
        {(['revenue', 'expense', 'transfer'] as const).map((type) => (
          <button
            key={type}
            type="button"
            disabled={!!initialData}
            onClick={() => changeType(type)}
            className={[
              'h-10 text-sm font-medium transition disabled:cursor-not-allowed',
              watchedType === type
                ? type === 'revenue'
                  ? 'bg-emerald-600 text-white'
                  : type === 'expense'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            ].join(' ')}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <FormField id="description" label="Descricao" error={errors.description?.message} required>
        <Input id="description" placeholder="Ex: Aluguel escritorio" {...register('description')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="amount" label="Valor" error={errors.originalAmount?.message} required className="sm:col-span-2">
          <Input id="amount" type="number" step="0.01" min="0.01" placeholder="0,00" {...register('originalAmount')} />
        </FormField>
        <FormField id="currency" label="Moeda" required>
          <Select id="currency" {...register('originalCurrency')}>
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
          </Select>
        </FormField>
      </div>

      {isForeign ? (
        <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="exchangeRate" label={`Cambio 1 ${watchedCurrency}`} error={errors.exchangeRate?.message} required>
              <Input id="exchangeRate" type="number" step="0.0001" min="0.0001" {...register('exchangeRate')} />
            </FormField>
            <FormField id="exchangeRateDate" label="Data do cambio" error={errors.exchangeRateDate?.message}>
              <Input id="exchangeRateDate" type="date" {...register('exchangeRateDate')} />
            </FormField>
          </div>
          {convertedAmount > 0 ? (
            <p className="text-xs font-medium text-blue-700">{formatCurrency(convertedAmount, companyBaseCurrency)}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="competenceDate" label="Competencia (DRE)" error={errors.competenceDate?.message} required>
          <Input id="competenceDate" type="date" {...register('competenceDate')} />
        </FormField>
        <FormField id="dueDate" label="Vencimento" error={errors.dueDate?.message} required>
          <Input id="dueDate" type="date" {...register('dueDate')} />
        </FormField>
      </div>

      {!isTransfer ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="categoryId" label="Categoria" error={errors.categoryId?.message} required>
            <SearchableSelect
              options={categoryOptions}
              value={watch('categoryId') ?? ''}
              onChange={(value) => setValue('categoryId', value || null)}
              placeholder="Buscar categoria"
              allowEmpty={false}
            />
          </FormField>
          <FormField id="costCenterId" label="Centro de custo" error={errors.costCenterId?.message} required>
            <SearchableSelect
              options={costCenterOptions}
              value={watch('costCenterId') ?? ''}
              onChange={(value) => setValue('costCenterId', value || null)}
              placeholder="Buscar centro"
              allowEmpty={false}
            />
          </FormField>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="status" label="Status" required>
          <Select id="status" {...register('status')}>
            <option value="pending">Pendente</option>
            <option value={watchedType === 'revenue' ? 'received' : 'paid'}>{watchedType === 'revenue' ? 'Recebido' : 'Pago'}</option>
          </Select>
        </FormField>
        <FormField id="bankAccountId" label={isTransfer ? 'Conta origem' : 'Conta bancaria'} error={errors.bankAccountId?.message} required={isPaid || isTransfer}>
          <SearchableSelect
            options={accountOptions}
            value={watch('bankAccountId') ?? ''}
            onChange={(value) => setValue('bankAccountId', value || null)}
            placeholder="Selecionar conta"
            allowEmpty={!isPaid && !isTransfer}
          />
        </FormField>
      </div>

      {isTransfer ? (
        <FormField id="destBankAccountId" label="Conta destino" error={errors.destBankAccountId?.message} required>
          <SearchableSelect
            options={accountOptions.filter((account) => account.value !== watch('bankAccountId'))}
            value={watch('destBankAccountId') ?? ''}
            onChange={(value) => setValue('destBankAccountId', value || null)}
            placeholder="Selecionar destino"
            allowEmpty={false}
          />
        </FormField>
      ) : null}

      {isPaid ? (
        <FormField id="paymentDate" label="Pagamento (fluxo de caixa)" error={errors.paymentDate?.message} required>
          <Input id="paymentDate" type="date" max={today} {...register('paymentDate')} />
        </FormField>
      ) : null}

      <FormField id="contactId" label="Contato">
        <SearchableSelect
          options={contactOptions}
          value={watch('contactId') ?? ''}
          onChange={(value) => setValue('contactId', value || null)}
          placeholder="Buscar contato"
        />
      </FormField>

      <button type="button" className="text-sm font-medium text-gray-500 hover:text-gray-700" onClick={() => setShowExtras((current) => !current)}>
        {showExtras ? 'Ocultar opcoes' : 'Mais opcoes'}
      </button>

      {showExtras ? (
        <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <FormField id="notes" label="Observacoes" error={errors.notes?.message}>
            <textarea
              id="notes"
              className="min-h-20 w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              {...register('notes')}
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="sourceDocumentNumber" label="Documento" error={errors.sourceDocumentNumber?.message}>
              <Input id="sourceDocumentNumber" {...register('sourceDocumentNumber')} />
            </FormField>
            <FormField id="externalReference" label="Referencia externa" error={errors.externalReference?.message}>
              <Input id="externalReference" {...register('externalReference')} />
            </FormField>
          </div>
        </div>
      ) : null}

      {!initialData && !isTransfer && watchedStatus === 'pending' ? (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between bg-gray-50 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={() => {
              setShowInstallment((current) => !current);
              setShowRecurrence(false);
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Rows3 className="h-4 w-4 text-gray-400" />
              Parcelar
            </span>
            <span className="text-xs text-gray-400">{showInstallment ? 'Aberto' : 'Fechado'}</span>
          </button>

          {showInstallment ? (
            <div className="space-y-3 border-t border-gray-100 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="installmentCount" label="Parcelas" error={errors.installmentCount?.message} required>
                  <Input
                    id="installmentCount"
                    type="number"
                    min="2"
                    max="360"
                    {...register('installmentCount', { setValueAs: optionalNumber })}
                  />
                </FormField>
                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                  <p className="text-xs font-medium uppercase text-gray-400">Primeiro vencimento</p>
                  <p className="mt-1">{watchedDueDate}</p>
                </div>
              </div>

              {installmentPreviews.length > 0 ? (
                <div className="overflow-hidden rounded-md border border-gray-100 text-xs">
                  {installmentPreviews.map((preview) => (
                    <div key={preview.number} className="flex items-center justify-between border-b border-gray-50 px-3 py-1.5 last:border-0">
                      <span className="text-gray-500">
                        Parcela {preview.number} / {preview.dueDate}
                      </span>
                      <span className="font-medium text-gray-800">{formatCurrency(preview.originalAmount, watchedCurrency)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 font-medium">
                    <span className="text-gray-600">Total</span>
                    <span className="text-emerald-700">{formatCurrency(watchedAmount, watchedCurrency)}</span>
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-gray-400">Competencia: {watchedCompetenceDate}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!initialData && !isTransfer && watchedStatus === 'pending' && !showInstallment ? (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between bg-gray-50 px-4 text-sm font-medium text-gray-700 hover:bg-gray-100"
            onClick={() => setShowRecurrence((current) => !current)}
          >
            <span className="inline-flex items-center gap-2">
              <Repeat className="h-4 w-4 text-gray-400" />
              Repetir
            </span>
            <span className="text-xs text-gray-400">{showRecurrence ? 'Aberto' : 'Fechado'}</span>
          </button>

          {showRecurrence ? (
            <div className="space-y-3 border-t border-gray-100 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="recurrenceFrequency" label="Frequencia">
                  <Select id="recurrenceFrequency" {...register('recurrence.frequency')}>
                    {FREQUENCY_LABELS.map((frequency) => (
                      <option key={frequency.value} value={frequency.value}>
                        {frequency.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField id="recurrenceDayOfMonth" label="Dia do mes">
                  <Input
                    id="recurrenceDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    {...register('recurrence.dayOfMonth', { setValueAs: optionalNumber })}
                  />
                </FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="recurrenceEndDate" label="Termina em">
                  <Input id="recurrenceEndDate" type="date" {...register('recurrence.endDate', { setValueAs: (value) => value || null })} />
                </FormField>
                <FormField id="recurrenceOccurrencesLimit" label="Ocorrencias">
                  <Input
                    id="recurrenceOccurrencesLimit"
                    type="number"
                    min="1"
                    max="360"
                    {...register('recurrence.occurrencesLimit', { setValueAs: optionalNumber })}
                  />
                </FormField>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {serverError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{extractApiError(serverError)}</div> : null}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : initialData ? 'Salvar alteracoes' : 'Salvar lancamento'}
        </Button>
      </div>
    </form>
  );
}
