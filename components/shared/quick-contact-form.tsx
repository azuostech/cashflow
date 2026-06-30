'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createContactSchema } from '@/lib/validations/settings.schema';

type QuickContactType = 'customer' | 'supplier' | 'both' | 'employee' | 'other';

interface QuickContactFormProps {
  defaultName?: string;
  defaultType?: QuickContactType;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function QuickContactForm({ defaultName = '', defaultType = 'supplier', onSave, onCancel }: QuickContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      name: defaultName,
      type: defaultType,
      document: '',
      email: '',
      phone: ''
    }
  });

  async function onSubmit(values: Record<string, string>) {
    const parsed = createContactSchema.safeParse({
      name: values.name,
      type: values.type,
      document: values.document || null,
      email: values.email || null,
      phone: values.phone || null
    });

    if (!parsed.success) {
      setError('Revise os campos antes de salvar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contato.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <FormField id="quick-contact-name" label="Nome" required>
        <Input id="quick-contact-name" placeholder="Nome do contato" {...register('name')} />
      </FormField>

      <FormField id="quick-contact-type" label="Tipo" required>
        <Select id="quick-contact-type" {...register('type')}>
          <option value="customer">Cliente</option>
          <option value="supplier">Fornecedor</option>
          <option value="both">Cliente e Fornecedor</option>
          <option value="employee">Funcionario</option>
          <option value="other">Outro</option>
        </Select>
      </FormField>

      <FormField id="quick-contact-document" label="CNPJ / CPF">
        <Input id="quick-contact-document" placeholder="00.000.000/0000-00 ou 000.000.000-00" {...register('document')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="quick-contact-email" label="E-mail">
          <Input id="quick-contact-email" type="email" placeholder="contato@empresa.com" {...register('email')} />
        </FormField>
        <FormField id="quick-contact-phone" label="Telefone">
          <Input id="quick-contact-phone" placeholder="(00) 00000-0000" {...register('phone')} />
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar contato'}
        </Button>
      </div>
    </form>
  );
}
