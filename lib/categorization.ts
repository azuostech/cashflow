import { createClient } from '@/lib/supabase/server';

interface Category {
  id: string;
  company_id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  keywords: string[] | null;
}

export async function categorizeTransaction(description: string, accountId: string): Promise<Category | null> {
  const supabase = createClient();

  const { data: account, error: accountError } = await supabase
    .from('bank_accounts')
    .select('company_id')
    .eq('id', accountId)
    .single();

  if (accountError || !account) return null;

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', account.company_id);

  if (error || !categories?.length) return null;

  const normalized = description.toLowerCase();

  for (const category of categories as Category[]) {
    const keywords = category.keywords ?? [];
    for (const keyword of keywords) {
      if (!keyword) continue;
      const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');
      if (regex.test(normalized)) {
        return category;
      }
    }
  }

  return null;
}

export async function applyCategoryToSimilar(categoryId: string, keyword: string, companyId: string) {
  const supabase = createClient();

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, statement_id, description')
    .is('category_id', null)
    .ilike('description', `%${keyword}%`);

  if (error || !transactions?.length) return { count: 0 };

  const statementIds = Array.from(new Set(transactions.map((t) => t.statement_id)));

  const { data: statements } = await supabase
    .from('statements')
    .select('id, bank_accounts!inner(company_id)')
    .in('id', statementIds)
    .eq('bank_accounts.company_id', companyId);

  const valid = new Set((statements ?? []).map((s) => s.id));
  const idsToUpdate = transactions.filter((t) => valid.has(t.statement_id)).map((t) => t.id);

  if (!idsToUpdate.length) return { count: 0 };

  await supabase.from('transactions').update({ category_id: categoryId }).in('id', idsToUpdate);

  return { count: idsToUpdate.length };
}
