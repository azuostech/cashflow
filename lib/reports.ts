import { monthRange } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';

export async function getFirstAccount(companyId: string) {
  const supabase = createClient();

  const { data: latestStatement } = await supabase
    .from('statements')
    .select('account_id, bank_accounts!inner(id, bank_name, agency, account_number, company_id)')
    .eq('bank_accounts.company_id', companyId)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestStatement?.bank_accounts) {
    const account = Array.isArray(latestStatement.bank_accounts)
      ? latestStatement.bank_accounts[0]
      : latestStatement.bank_accounts;

    if (account) return account;
  }

  const { data: fallbackAccount } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, agency, account_number, company_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return fallbackAccount;
}

export async function getCompanyAccounts(companyId: string) {
  const supabase = createClient();

  const { data } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, agency, account_number, company_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  return data ?? [];
}

export async function getStatementForMonth(accountId: string, month: string, companyId?: string) {
  const { start, end } = monthRange(month);
  const supabase = createClient();

  let query = supabase
    .from('statements')
    .select('*, bank_accounts!inner(company_id)')
    .eq('account_id', accountId)
    .lte('period_start', end)
    .gte('period_end', start)
    .order('uploaded_at', { ascending: false })
    .limit(1);

  if (companyId) {
    query = query.eq('bank_accounts.company_id', companyId);
  }

  const { data } = await query.single();

  return data;
}

export async function getStatementForRange(accountId: string, startDate: string, endDate: string, companyId?: string) {
  const supabase = createClient();

  let query = supabase
    .from('statements')
    .select('*, bank_accounts!inner(company_id)')
    .eq('account_id', accountId)
    .lte('period_start', endDate)
    .gte('period_end', startDate)
    .order('uploaded_at', { ascending: false })
    .limit(1);

  if (companyId) {
    query = query.eq('bank_accounts.company_id', companyId);
  }

  const { data } = await query.single();

  return data;
}
