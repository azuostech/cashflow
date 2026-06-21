import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { parseOFX } from '@/lib/parsers/ofx-parser';
import { categorizeTransaction } from '@/lib/categorization';
import { jsonError, jsonOk } from '@/lib/utils/http';

export async function POST(request: Request) {
  const session = await getSessionContext();
  if (!session) return jsonError('Nao autenticado.', 401);
  if (!session.companyId) return jsonError('Selecione uma empresa para continuar.', 400);

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const accountId = String(formData.get('accountId') ?? '');
  const fileNameLower = file?.name?.toLowerCase() ?? '';
  const acceptedMime = new Set(['application/x-ofx', 'application/ofx', 'text/ofx', 'text/plain', 'application/octet-stream']);
  const isOfx = fileNameLower.endsWith('.ofx') || acceptedMime.has(file?.type ?? '');

  if (!file || !isOfx) {
    return jsonError('Arquivo OFX invalido. Envie um arquivo com extensao .ofx.', 400);
  }

  if (!accountId) {
    return jsonError('Conta bancaria nao informada.', 400);
  }

  const supabase = createClient();

  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id, company_id, bank_name, account_number')
    .eq('id', accountId)
    .eq('company_id', session.companyId)
    .single();

  if (!account) {
    return jsonError('Conta nao encontrada para sua empresa.', 404);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseOFX(buffer, {
      expectedBankName: account.bank_name,
      expectedAccountNumber: account.account_number
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar arquivo OFX.';
    return jsonError(message, 400);
  }

  const fileName = `${Date.now()}_${file.name}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('statements')
    .upload(fileName, buffer, { contentType: 'application/ofx' });

  if (uploadError) {
    return jsonError(uploadError.message, 500);
  }

  const { data: statement, error: statementError } = await supabase
    .from('statements')
    .insert({
      account_id: accountId,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      initial_balance: parsed.initialBalance,
      final_balance: parsed.finalBalance,
      file_name: file.name,
      file_url: uploadData.path,
      status: 'processing'
    })
    .select('*')
    .single();

  if (statementError || !statement) {
    await supabase.storage.from('statements').remove([fileName]);
    return jsonError(statementError?.message ?? 'Falha ao salvar extrato.', 500);
  }

  const transactionsToInsert = await Promise.all(
    parsed.transactions.map(async (transaction) => {
      const category = await categorizeTransaction(transaction.description, accountId);

      return {
        statement_id: statement.id,
        category_id: category?.id ?? null,
        date: transaction.date,
        description: transaction.description,
        document_number: transaction.documentNumber,
        type: transaction.type,
        amount: transaction.amount,
        balance_after: transaction.balanceAfter
      };
    })
  );

  if (transactionsToInsert.length) {
    const { error: transactionError } = await supabase.from('transactions').insert(transactionsToInsert);

    if (transactionError) {
      await supabase.from('statements').update({ status: 'error' }).eq('id', statement.id);
      return jsonError(transactionError.message, 500);
    }
  }

  await supabase.from('statements').update({ status: 'completed' }).eq('id', statement.id);

  return jsonOk({
    success: true,
    statement,
    transactionsCount: parsed.transactions.length,
    bank: parsed.bank,
    warnings: parsed.warnings
  });
}
