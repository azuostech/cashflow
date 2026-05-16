import PDFDocument from 'pdfkit';
import { currentMonth } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/utils/format';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext } from '@/lib/auth';
import { getFirstAccount, getStatementForMonth } from '@/lib/reports';
import { jsonError } from '@/lib/utils/http';

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

  const { data: dailyData } = await supabase.rpc('get_daily_balance', {
    p_statement_id: statement.id
  });

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(18).text('Relatorio de Fluxo de Caixa', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`Periodo: ${month}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).text(`Saldo inicial: ${formatCurrency(Number(statement.initial_balance ?? 0))}`);
  doc.fontSize(10).text(`Saldo final: ${formatCurrency(Number(statement.final_balance ?? 0))}`);
  doc.moveDown();

  doc.fontSize(12).text('Resumo diario', { underline: true });
  doc.moveDown(0.5);

  for (const day of dailyData ?? []) {
    doc
      .fontSize(10)
      .text(
        `${day.date} | Entradas: ${formatCurrency(Number(day.total_in))} | Saidas: ${formatCurrency(Number(day.total_out))} | Saldo: ${formatCurrency(Number(day.end_balance))}`
      );
  }

  doc.end();

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="relatorio-${month}.pdf"`
    }
  });
}
