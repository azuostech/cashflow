'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/form-field';
import { formatCNPJ } from '@/lib/utils/cnpj';
import { updateCompanySchema, type UpdateCompanyInput } from '@/lib/validations/settings.schema';

interface Company {
  id: string;
  name: string;
  legalName: string | null;
  document: string;
  baseCurrency: string;
  sector: string | null;
  size: 'micro' | 'small' | 'medium' | 'large' | null;
  fiscalYearStart: number;
  timezone: string;
}

const SECTORS = ['Tecnologia', 'Servicos', 'Comercio', 'Industria', 'Saude', 'Educacao', 'Construcao', 'Agronegocio', 'Financeiro', 'Outro'];

const SIZES = [
  { value: 'micro', label: 'Microempresa' },
  { value: 'small', label: 'Pequena' },
  { value: 'medium', label: 'Media' },
  { value: 'large', label: 'Grande' }
];

const MONTHS = [
  ['1', 'Janeiro'],
  ['2', 'Fevereiro'],
  ['3', 'Marco'],
  ['4', 'Abril'],
  ['5', 'Maio'],
  ['6', 'Junho'],
  ['7', 'Julho'],
  ['8', 'Agosto'],
  ['9', 'Setembro'],
  ['10', 'Outubro'],
  ['11', 'Novembro'],
  ['12', 'Dezembro']
];

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors }
  } = useForm<UpdateCompanyInput>();

  useEffect(() => {
    async function loadCompany() {
      const response = await fetch('/api/companies');
      if (!response.ok) {
        setError('Nao foi possivel carregar a empresa.');
        return;
      }

      const companies: Company[] = await response.json();
      const activeCompany = companies[0];

      if (!activeCompany) {
        setError('Nenhuma empresa ativa encontrada.');
        return;
      }

      setCompany(activeCompany);
      reset({
        name: activeCompany.name,
        legalName: activeCompany.legalName,
        sector: activeCompany.sector,
        size: activeCompany.size,
        fiscalYearStart: activeCompany.fiscalYearStart,
        timezone: activeCompany.timezone
      });
    }

    void loadCompany();
  }, [reset]);

  async function onSubmit(formData: UpdateCompanyInput) {
    if (!company) return;

    const parsed = updateCompanySchema.safeParse(formData);
    if (!parsed.success) {
      setError('Revise os campos antes de salvar.');
      return;
    }

    setLoading(true);
    setError('');

    const response = await fetch(`/api/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data)
    });

    if (!response.ok) {
      setError('Nao foi possivel salvar as alteracoes.');
      setLoading(false);
      return;
    }

    const updated: Company = await response.json();
    setCompany(updated);
    reset({
      name: updated.name,
      legalName: updated.legalName,
      sector: updated.sector,
      size: updated.size,
      fiscalYearStart: updated.fiscalYearStart,
      timezone: updated.timezone
    });
    setSaved(true);
    setLoading(false);
    window.setTimeout(() => setSaved(false), 3000);
  }

  if (!company && !error) {
    return <div className="h-40 max-w-2xl animate-pulse rounded-lg bg-gray-100" />;
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Configuracoes da empresa</h1>
        <p className="mt-1 text-sm text-gray-500">CNPJ e moeda base nao podem ser alterados apos a criacao.</p>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {company ? (
        <>
          <div className="mb-6 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-5 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">CNPJ</p>
              <p className="text-sm font-medium text-gray-700">{formatCNPJ(company.document)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Moeda base</p>
              <p className="text-sm font-medium text-gray-700">{company.baseCurrency}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <FormField id="name" label="Nome fantasia" error={errors.name?.message} required>
              <Input id="name" {...register('name')} />
            </FormField>

            <FormField id="legalName" label="Razao social" error={errors.legalName?.message}>
              <Input id="legalName" placeholder="Opcional" {...register('legalName', { setValueAs: (value) => value || null })} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="sector" label="Setor">
                <Select id="sector" {...register('sector', { setValueAs: (value) => value || null })}>
                  <option value="">Selecionar...</option>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id="size" label="Porte">
                <Select id="size" {...register('size', { setValueAs: (value) => value || null })}>
                  <option value="">Selecionar...</option>
                  {SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="fiscalYearStart" label="Inicio do exercicio fiscal">
                <Select id="fiscalYearStart" {...register('fiscalYearStart')}>
                  {MONTHS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField id="timezone" label="Fuso horario">
                <Input id="timezone" {...register('timezone')} />
              </FormField>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={loading || !isDirty}>
                {loading ? 'Salvando...' : 'Salvar alteracoes'}
              </Button>
              {saved ? <span className="text-sm text-emerald-600">Salvo com sucesso</span> : null}
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
