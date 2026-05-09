-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Timestamp helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tables
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj varchar(18) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL DEFAULT '',
  full_name text,
  created_at timestamptz DEFAULT NOW(),
  last_login timestamptz
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  bank_name text NOT NULL,
  agency varchar(10),
  account_number varchar(20),
  account_type text DEFAULT 'Corrente',
  created_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  initial_balance numeric(15,2),
  final_balance numeric(15,2),
  file_name text,
  file_url text,
  uploaded_at timestamptz DEFAULT NOW(),
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error'))
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  color varchar(7) NOT NULL,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid REFERENCES public.statements(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  date date NOT NULL,
  description text NOT NULL,
  document_number text,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  amount numeric(15,2) NOT NULL,
  balance_after numeric(15,2),
  is_manual boolean DEFAULT FALSE,
  is_hidden boolean DEFAULT FALSE,
  notes text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Tenant resolver (depends on public.users)
CREATE OR REPLACE FUNCTION public.get_current_company_id()
RETURNS uuid AS $$
  SELECT u.company_id
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_statement ON public.transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_statements_period ON public.statements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_users_company ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_categories_company ON public.categories(company_id);

-- Triggers
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- RLS enable
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies companies
DROP POLICY IF EXISTS companies_select_policy ON public.companies;
CREATE POLICY companies_select_policy
ON public.companies FOR SELECT
USING (id = public.get_current_company_id());

DROP POLICY IF EXISTS companies_update_policy ON public.companies;
CREATE POLICY companies_update_policy
ON public.companies FOR UPDATE
USING (id = public.get_current_company_id());

-- Policies users
DROP POLICY IF EXISTS users_select_policy ON public.users;
CREATE POLICY users_select_policy
ON public.users FOR SELECT
USING (company_id = public.get_current_company_id());

DROP POLICY IF EXISTS users_update_policy ON public.users;
CREATE POLICY users_update_policy
ON public.users FOR UPDATE
USING (company_id = public.get_current_company_id());

DROP POLICY IF EXISTS users_insert_policy ON public.users;
CREATE POLICY users_insert_policy
ON public.users FOR INSERT
WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

-- Policies bank_accounts
DROP POLICY IF EXISTS bank_accounts_all_policy ON public.bank_accounts;
CREATE POLICY bank_accounts_all_policy
ON public.bank_accounts FOR ALL
USING (company_id = public.get_current_company_id())
WITH CHECK (company_id = public.get_current_company_id());

-- Policies categories
DROP POLICY IF EXISTS categories_all_policy ON public.categories;
CREATE POLICY categories_all_policy
ON public.categories FOR ALL
USING (company_id = public.get_current_company_id())
WITH CHECK (company_id = public.get_current_company_id());

-- Policies statements
DROP POLICY IF EXISTS statements_all_policy ON public.statements;
CREATE POLICY statements_all_policy
ON public.statements FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.bank_accounts ba
    WHERE ba.id = statements.account_id
      AND ba.company_id = public.get_current_company_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bank_accounts ba
    WHERE ba.id = statements.account_id
      AND ba.company_id = public.get_current_company_id()
  )
);

-- Policies transactions
DROP POLICY IF EXISTS transactions_all_policy ON public.transactions;
CREATE POLICY transactions_all_policy
ON public.transactions FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.statements s
    JOIN public.bank_accounts ba ON ba.id = s.account_id
    WHERE s.id = transactions.statement_id
      AND ba.company_id = public.get_current_company_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.statements s
    JOIN public.bank_accounts ba ON ba.id = s.account_id
    WHERE s.id = transactions.statement_id
      AND ba.company_id = public.get_current_company_id()
  )
);

-- RPC functions
CREATE OR REPLACE FUNCTION public.get_top_categories(
  p_statement_id uuid,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  category_color varchar(7),
  total_amount numeric(15,2),
  transaction_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.color,
    SUM(t.amount) AS total_amount,
    COUNT(t.id) AS transaction_count
  FROM public.categories c
  JOIN public.transactions t ON t.category_id = c.id
  WHERE t.statement_id = p_statement_id
    AND t.type = 'debit'
    AND COALESCE(t.is_hidden, FALSE) = FALSE
  GROUP BY c.id, c.name, c.color
  ORDER BY total_amount DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.get_daily_balance(
  p_statement_id uuid
)
RETURNS TABLE (
  date date,
  total_in numeric(15,2),
  total_out numeric(15,2),
  end_balance numeric(15,2),
  transaction_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.date,
    SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END) AS total_in,
    SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END) AS total_out,
    MAX(t.balance_after) AS end_balance,
    COUNT(t.id) AS transaction_count
  FROM public.transactions t
  WHERE t.statement_id = p_statement_id
    AND COALESCE(t.is_hidden, FALSE) = FALSE
  GROUP BY t.date
  ORDER BY t.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Storage bucket + RLS policies for statement uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('statements', 'statements', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS statements_bucket_insert ON storage.objects;
CREATE POLICY statements_bucket_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'statements'
);

DROP POLICY IF EXISTS statements_bucket_select ON storage.objects;
CREATE POLICY statements_bucket_select
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'statements'
);

DROP POLICY IF EXISTS statements_bucket_delete ON storage.objects;
CREATE POLICY statements_bucket_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'statements'
);
