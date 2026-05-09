import { monthRange } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/server';

export async function getFirstAccount(companyId: string) {
  const supabase = createClient();

  const { data } = await supabase
    .from('bank_accounts')
    .select('id, bank_name, agency, account_number, company_id')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  return data;
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

export async function getStatementForMonth(accountId: string, month: string) {
  const { start, end } = monthRange(month);
  const supabase = createClient();

  const { data } = await supabase
    .from('statements')
    .select('*')
    .eq('account_id', accountId)
    .lte('period_start', end)
    .gte('period_end', start)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}

export async function getStatementForRange(accountId: string, startDate: string, endDate: string) {
  const supabase = createClient();

  const { data } = await supabase
    .from('statements')
    .select('*')
    .eq('account_id', accountId)
    .lte('period_start', endDate)
    .gte('period_end', startDate)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .single();

  return data;
}
