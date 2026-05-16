import ExcelJS from 'exceljs';
import { currentMonth } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { getFirstAccount, getStatementForMonth } from '@/lib/reports';
import { jsonError } from '@/lib/utils/http';

function getCategoryName(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value[0]?.name ?? '';
  }

  return (value as { name?: string }).name ?? '';
}

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const payload = await request.json().catch(() => ({}));
  const month = typeof payload.month === 'string' ? payload.month : currentMonth();
  let accountId = typeof payload.accountId === 'string' ? payload.accountId : null;

  if (!accountId) {
    const account = await getFirstAccount(session.companyId);
    accountId = account?.id ?? null;
  }

  if (!accountId) return jsonError('Nenhuma conta encontrada.', 404);

  const supabase = createClient();
  const { data: scopedAccount } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('company_id', session.companyId)
    .maybeSingle();

  if (!scopedAccount) {
    return jsonError('Conta bancaria fora da empresa selecionada.', 403);
  }

  const statement = await getStatementForMonth(accountId, month, session.companyId);
  if (!statement) return jsonError('Nao ha dados para o periodo selecionado.', 404);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, description, type, amount, balance_after, categories(name)')
    .eq('statement_id', statement.id)
    .order('date', { ascending: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fluxo de Caixa');

  sheet.columns = [
    { header: 'Data', key: 'date', width: 14 },
    { header: 'Descricao', key: 'description', width: 45 },
    { header: 'Categoria', key: 'category', width: 24 },
    { header: 'Entradas', key: 'credit', width: 16 },
    { header: 'Saidas', key: 'debit', width: 16 },
    { header: 'Saldo', key: 'balance', width: 16 }
  ];

  for (const tx of transactions ?? []) {
    sheet.addRow({
      date: tx.date,
      description: tx.description,
      category: getCategoryName(tx.categories),
      credit: tx.type === 'credit' ? Number(tx.amount) : 0,
      debit: tx.type === 'debit' ? Number(tx.amount) : 0,
      balance: Number(tx.balance_after ?? 0)
    });
  }

  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="relatorio-${month}.xlsx"`
    }
  });
}
