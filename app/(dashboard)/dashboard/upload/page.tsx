'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { DropZone } from '@/components/upload/DropZone';
import { UploadPreview } from '@/components/upload/UploadPreview';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { formatDateBR } from '@/lib/utils/format';

interface Account {
  id: string;
  bank_name: string;
  agency: string | null;
  account_number: string | null;
}

interface Statement {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  file_name: string | null;
  uploaded_at: string | null;
  status: 'processing' | 'completed' | 'error';
  transactions_count: number;
  bank_accounts: {
    id: string;
    bank_name: string;
  } | {
    id: string;
    bank_name: string;
  }[];
}

function getStatementBankAccount(statement: Statement) {
  return Array.isArray(statement.bank_accounts) ? statement.bank_accounts[0] : statement.bank_accounts;
}

function toPtDateTime(value: string | null): string {
  if (!value) return '-';

  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

function toPtDate(value: string): string {
  return formatDateBR(value);
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [deletingStatementId, setDeletingStatementId] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const response = await fetch('/api/statements/list', { cache: 'no-store' });
    const data = await response.json();

    const accountsData = data?.accounts ?? [];
    const statementsData = data?.statements ?? [];

    setAccounts(accountsData);
    setStatements(statementsData);
  }, []);

  useEffect(() => {
    loadData().catch(() => {
      setAccounts([]);
      setStatements([]);
    });
  }, [loadData]);

  const bankOptions = useMemo(() => {
    return Array.from(new Set(accounts.map((account) => account.bank_name).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!selectedBank) return accounts;
    return accounts.filter((account) => account.bank_name === selectedBank);
  }, [accounts, selectedBank]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedBank('');
      setSelectedAccount('');
      return;
    }

    const nextBank = selectedBank && bankOptions.includes(selectedBank) ? selectedBank : bankOptions[0] ?? '';
    if (nextBank !== selectedBank) {
      setSelectedBank(nextBank);
      return;
    }

    const selectedAccountStillVisible = filteredAccounts.some((account) => account.id === selectedAccount);
    if (!selectedAccountStillVisible) {
      setSelectedAccount(filteredAccounts[0]?.id ?? '');
    }
  }, [accounts, bankOptions, filteredAccounts, selectedAccount, selectedBank]);

  async function upload() {
    if (!file || !selectedAccount) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.set('file', file);
    formData.set('accountId', selectedAccount);

    const response = await fetch('/api/statements/upload', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      setResult(data.error ?? 'Falha no upload.');
      setLoading(false);
      return;
    }

    const warnings = Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : [];
    const detectedBank = data.bank?.bankName ? ` Banco detectado: ${data.bank.bankName}.` : '';
    const warningText = warnings.length ? ` Atencao: ${warnings.join(' ')}` : '';

    setResult(`Upload concluido: ${data.transactionsCount} transacoes processadas.${detectedBank}${warningText}`);
    setFile(null);
    setLoading(false);
    await loadData();
  }

  async function deleteStatement(statementId: string) {
    const confirmed = window.confirm('Deseja excluir este upload e todas as transacoes vinculadas?');
    if (!confirmed) return;

    setDeletingStatementId(statementId);

    const response = await fetch(`/api/statements/${statementId}`, {
      method: 'DELETE'
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setResult(data.error ?? 'Falha ao excluir upload.');
      setDeletingStatementId(null);
      return;
    }

    setDeletingStatementId(null);
    setResult('Upload excluido com sucesso.');
    await loadData();
  }

  const visibleStatements = useMemo(() => {
    return statements.filter((statement) => {
      const bankAccount = getStatementBankAccount(statement);

      if (selectedAccount) return statement.account_id === selectedAccount;
      if (selectedBank) return bankAccount?.bank_name === selectedBank;
      return true;
    });
  }, [selectedAccount, selectedBank, statements]);

  return (
    <section>
      <Header title="Upload de Extrato" subtitle="Envie arquivo OFX para extracao automatica." />

      <Card>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            value={selectedBank}
            onChange={(event) => {
              setSelectedBank(event.target.value);
              setSelectedAccount('');
            }}
          >
            <option value="">Selecione o banco</option>
            {bankOptions.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </Select>

          <Select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}>
            <option value="">Selecione a conta</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank_name} - {account.agency ?? 's/ag'} / {account.account_number ?? 's/conta'}
              </option>
            ))}
          </Select>
        </div>

        <DropZone onFileSelected={setFile} disabled={loading} />
        <UploadPreview file={file} />

        <div className="mt-4 flex gap-3">
          <Button type="button" onClick={upload} disabled={!file || !selectedAccount || loading}>
            {loading ? 'Processando...' : 'Enviar extrato'}
          </Button>
          <Button type="button" variant="outline" onClick={() => setFile(null)} disabled={loading}>
            Limpar
          </Button>
        </div>

        {result ? <p className="mt-4 rounded-lg bg-app-muted p-3 text-sm">{result}</p> : null}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Historico de uploads</h2>
        <div className="space-y-3">
          {visibleStatements.map((statement) => {
            const bankAccount = getStatementBankAccount(statement);

            return (
              <div key={statement.id} className="rounded-lg border border-app-border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{statement.file_name || 'Arquivo sem nome'}</p>
                    <p className="text-sm text-app-subtle">
                      Conta: {bankAccount?.bank_name ?? '-'} • Upload: {toPtDateTime(statement.uploaded_at)}
                    </p>
                    <p className="text-sm text-app-subtle">
                      Periodo: {toPtDate(statement.period_start)} ate {toPtDate(statement.period_end)} • Status: {statement.status} • Transacoes:{' '}
                      {statement.transactions_count}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => deleteStatement(statement.id)}
                    disabled={deletingStatementId === statement.id}
                  >
                    {deletingStatementId === statement.id ? 'Excluindo...' : 'Excluir upload'}
                  </Button>
                </div>
              </div>
            );
          })}

          {visibleStatements.length === 0 ? <p className="text-sm text-app-subtle">Nenhum upload encontrado para esta conta.</p> : null}
        </div>
      </Card>
    </section>
  );
}
