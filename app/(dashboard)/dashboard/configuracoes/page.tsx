'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface Account {
  id: string;
  bank_name: string;
  agency: string | null;
  account_number: string | null;
  account_type: string | null;
}

const initialForm = {
  bank_name: '',
  agency: '',
  account_number: '',
  account_type: 'Corrente'
};

export default function ConfiguracoesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAccounts() {
    const response = await fetch('/api/accounts/list');
    const data = await response.json();
    setAccounts(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadAccounts().catch(() => setAccounts([]));
  }, []);

  function reset() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function save() {
    setLoading(true);

    const isEditing = Boolean(editingId);
    const endpoint = isEditing ? `/api/accounts/${editingId}` : '/api/accounts/list';

    await fetch(endpoint, {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    await loadAccounts();
    reset();
    setLoading(false);
  }

  async function remove(id: string) {
    const confirmed = window.confirm('Excluir conta bancaria?');
    if (!confirmed) return;

    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    await loadAccounts();

    if (editingId === id) reset();
  }

  return (
    <section>
      <Header title="Configuracoes" subtitle="Gerencie contas bancarias da empresa." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Contas cadastradas</h2>
          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-lg border border-app-border p-4">
                <p className="font-semibold">{account.bank_name}</p>
                <p className="text-sm text-app-subtle">
                  Agencia: {account.agency || '-'} • Conta: {account.account_number || '-'} • Tipo: {account.account_type || '-'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(account.id);
                      setForm({
                        bank_name: account.bank_name,
                        agency: account.agency || '',
                        account_number: account.account_number || '',
                        account_type: account.account_type || 'Corrente'
                      });
                    }}
                  >
                    Editar
                  </Button>
                  <Button type="button" variant="danger" onClick={() => remove(account.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
            {accounts.length === 0 ? <p className="text-sm text-app-subtle">Nenhuma conta cadastrada.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{editingId ? 'Editar conta' : 'Nova conta'}</h2>
          <div className="space-y-3">
            <Input
              placeholder="Banco"
              value={form.bank_name}
              onChange={(event) => setForm((prev) => ({ ...prev, bank_name: event.target.value }))}
            />
            <Input
              placeholder="Agencia"
              value={form.agency}
              onChange={(event) => setForm((prev) => ({ ...prev, agency: event.target.value }))}
            />
            <Input
              placeholder="Numero da conta"
              value={form.account_number}
              onChange={(event) => setForm((prev) => ({ ...prev, account_number: event.target.value }))}
            />
            <Select
              value={form.account_type}
              onChange={(event) => setForm((prev) => ({ ...prev, account_type: event.target.value }))}
            >
              <option value="Corrente">Corrente</option>
              <option value="Poupanca">Poupanca</option>
              <option value="Investimento">Investimento</option>
            </Select>

            <div className="flex gap-2">
              <Button type="button" onClick={save} disabled={loading}>
                {loading ? 'Salvando...' : editingId ? 'Atualizar conta' : 'Criar conta'}
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                Limpar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
