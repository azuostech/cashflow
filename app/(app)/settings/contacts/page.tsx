'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormField } from '@/components/shared/form-field';
import { Modal } from '@/components/shared/modal';
import { TypeBadge } from '@/components/shared/type-badge';
import { useFetch } from '@/hooks/use-fetch';
import { formatCNPJ } from '@/lib/utils/cnpj';
import { createContactSchema, updateContactSchema } from '@/lib/validations/settings.schema';

interface Contact {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'both' | 'employee' | 'other';
  document: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  transactionCount?: number;
}

const CONTACT_TYPES = [
  { value: '', label: 'Todos os tipos' },
  { value: 'customer', label: 'Cliente' },
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'both', label: 'Cliente e Fornecedor' },
  { value: 'employee', label: 'Funcionario' },
  { value: 'other', label: 'Outro' }
];

function formatDocument(document: string | null) {
  if (!document) return '--';

  const cleaned = document.replace(/\D/g, '');
  if (cleaned.length === 14) return formatCNPJ(cleaned);
  if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return document;
}

export default function ContactsSettingsPage() {
  const { data: contacts, refetch } = useFetch<Contact[]>('/api/contacts?active=all');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [apiError, setApiError] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const filtered = useMemo(() => {
    return (contacts ?? []).filter((contact) => {
      if (!showInactive && !contact.active) return false;
      if (typeFilter && contact.type !== typeFilter) return false;
      if (!search) return true;

      const query = search.toLowerCase();
      return (
        contact.name.toLowerCase().includes(query) ||
        (contact.document ?? '').includes(query.replace(/\D/g, '')) ||
        (contact.email ?? '').toLowerCase().includes(query)
      );
    });
  }, [contacts, search, showInactive, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  async function saveContact(data: Record<string, unknown>, id?: string) {
    const response = await fetch(id ? `/api/contacts/${id}` : '/api/contacts', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error ?? 'Erro ao salvar contato.');
    }

    await refetch();
    setCreateOpen(false);
    setEditing(null);
  }

  async function deactivate(id: string) {
    if (!window.confirm('Desativar este contato?')) return;

    setApiError('');
    const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setApiError(result.error ?? 'Erro ao desativar contato.');
      return;
    }

    if (result.reason === 'has_linked_transactions') {
      setApiError('Contato possui lancamentos e foi desativado em vez de excluido fisicamente.');
    }

    await refetch();
  }

  async function reactivate(id: string) {
    setApiError('');
    const response = await fetch(`/api/contacts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true })
    });

    if (!response.ok) {
      setApiError('Erro ao reativar contato.');
      return;
    }

    await refetch();
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contatos</h1>
          <p className="mt-1 text-sm text-gray-500">Clientes, fornecedores e outros contatos da empresa.</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Novo contato
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nome, documento ou e-mail..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={typeFilter}
          onChange={(event) => {
            setTypeFilter(event.target.value);
            setPage(1);
          }}
          className="w-52"
        >
          {CONTACT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          Mostrar inativos
        </label>
        <span className="text-sm text-gray-400">{filtered.length} contatos</span>
      </div>

      {apiError ? <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{apiError}</div> : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead className="text-right">Lancamentos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-gray-400">
                  Nenhum contato encontrado
                </TableCell>
              </TableRow>
            ) : null}
            {paginated.map((contact) => (
              <TableRow key={contact.id} className={contact.active ? '' : 'opacity-60'}>
                <TableCell className="font-medium text-gray-900">{contact.name}</TableCell>
                <TableCell>
                  <TypeBadge type={contact.type} />
                  {!contact.active ? <TypeBadge type="inactive" className="ml-2" /> : null}
                </TableCell>
                <TableCell className="font-mono text-xs text-gray-500">{formatDocument(contact.document)}</TableCell>
                <TableCell className="text-gray-500">{contact.email ?? '--'}</TableCell>
                <TableCell className="text-right text-gray-500">{contact.transactionCount ?? 0}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {contact.active ? (
                      <>
                        <Button type="button" variant="outline" className="h-8 px-3" onClick={() => setEditing(contact)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 border-red-200 px-3 text-red-600 hover:bg-red-50"
                          onClick={() => deactivate(contact.id)}
                        >
                          Desativar
                        </Button>
                      </>
                    ) : (
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => reactivate(contact.id)}>
                        Reativar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <span className="self-center text-sm text-gray-500">
            Pagina {page} de {totalPages}
          </span>
          <Button type="button" variant="outline" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>
            Proxima
          </Button>
        </div>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo contato">
        <ContactForm onCancel={() => setCreateOpen(false)} onSave={(data) => saveContact(data)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar contato">
        {editing ? <ContactForm initialData={editing} onCancel={() => setEditing(null)} onSave={(data) => saveContact(data, editing.id)} /> : null}
      </Modal>
    </div>
  );
}

function ContactForm({
  initialData,
  onSave,
  onCancel
}: {
  initialData?: Contact;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      name: initialData?.name ?? '',
      type: initialData?.type ?? 'customer',
      document: initialData?.document ?? '',
      email: initialData?.email ?? '',
      phone: initialData?.phone ?? ''
    }
  });

  async function onSubmit(values: Record<string, string>) {
    const payload = {
      name: values.name,
      type: values.type,
      document: values.document || null,
      email: values.email || null,
      phone: values.phone || null
    };
    const parsed = initialData ? updateContactSchema.safeParse(payload) : createContactSchema.safeParse(payload);

    if (!parsed.success) {
      setError('Revise os campos antes de salvar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave(parsed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <FormField id="contact-name" label="Nome" required>
        <Input id="contact-name" placeholder="Nome do contato" {...register('name')} />
      </FormField>
      <FormField id="contact-type" label="Tipo" required>
        <Select id="contact-type" {...register('type')}>
          <option value="customer">Cliente</option>
          <option value="supplier">Fornecedor</option>
          <option value="both">Cliente e Fornecedor</option>
          <option value="employee">Funcionario</option>
          <option value="other">Outro</option>
        </Select>
      </FormField>
      <FormField id="contact-document" label="CNPJ / CPF">
        <Input id="contact-document" placeholder="00.000.000/0000-00 ou 000.000.000-00" {...register('document')} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="contact-email" label="E-mail">
          <Input id="contact-email" type="email" placeholder="contato@empresa.com" {...register('email')} />
        </FormField>
        <FormField id="contact-phone" label="Telefone">
          <Input id="contact-phone" placeholder="(00) 00000-0000" {...register('phone')} />
        </FormField>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : initialData ? 'Salvar' : 'Criar contato'}
        </Button>
      </div>
    </form>
  );
}
