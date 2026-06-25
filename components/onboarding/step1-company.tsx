'use client';

import { ChangeEvent, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { formatCNPJ } from '@/lib/utils/cnpj';
import {
  onboardingCompanySchema,
  type OnboardingCompanyFormInput,
  type OnboardingCompanyInput
} from '@/lib/validations/onboarding.schema';

interface OnboardingStep1CompanyProps {
  onComplete: (companyId: string) => void;
}

const MONTHS = [
  [1, 'Janeiro'],
  [2, 'Fevereiro'],
  [3, 'Marco'],
  [4, 'Abril'],
  [5, 'Maio'],
  [6, 'Junho'],
  [7, 'Julho'],
  [8, 'Agosto'],
  [9, 'Setembro'],
  [10, 'Outubro'],
  [11, 'Novembro'],
  [12, 'Dezembro']
] as const;

export function OnboardingStep1Company({ onComplete }: OnboardingStep1CompanyProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid }
  } = useForm<OnboardingCompanyFormInput, unknown, OnboardingCompanyInput>({
    resolver: zodResolver(onboardingCompanySchema),
    mode: 'onChange',
    defaultValues: {
      baseCurrency: 'BRL',
      timezone: 'America/Sao_Paulo',
      fiscalYearStart: 1
    }
  });

  function handleDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/\D/g, '');
    setValue('document', raw.length === 14 ? formatCNPJ(raw) : raw, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(data: OnboardingCompanyInput) {
    setLoading(true);
    setServerError('');

    const response = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData: { error?: unknown } = await response.json();
      setServerError(typeof errorData.error === 'string' ? errorData.error : 'Verifique os campos e tente novamente.');
      setLoading(false);
      return;
    }

    const company: { id: string } = await response.json();
    onComplete(company.id);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Dados da empresa</h2>
        <p className="mt-1 text-sm text-gray-500">Estas informacoes aparecem nos relatorios.</p>
      </div>

      <FormField id="name" label="Nome fantasia" error={errors.name?.message} required>
        <Input id="name" placeholder="Ex: Acme Corp" {...register('name')} />
      </FormField>

      <FormField id="legalName" label="Razao social" error={errors.legalName?.message}>
        <Input id="legalName" placeholder="Ex: Acme Corp Ltda" {...register('legalName')} />
      </FormField>

      <FormField id="document" label="CNPJ" error={errors.document?.message} required>
        <Input
          id="document"
          placeholder="00.000.000/0000-00"
          maxLength={18}
          {...register('document')}
          onChange={handleDocumentChange}
          value={watch('document') ?? ''}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="baseCurrency" label="Moeda base" error={errors.baseCurrency?.message} required>
          <Select id="baseCurrency" {...register('baseCurrency')}>
            <option value="BRL">BRL - Real Brasileiro</option>
            <option value="USD">USD - Dolar Americano</option>
          </Select>
        </FormField>

        <FormField id="fiscalYearStart" label="Inicio do exercicio fiscal" error={errors.fiscalYearStart?.message}>
          <Select id="fiscalYearStart" {...register('fiscalYearStart')}>
            {MONTHS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {serverError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading || !isValid} className="px-8">
          {loading ? 'Criando...' : 'Proximo'}
        </Button>
      </div>
    </form>
  );
}
