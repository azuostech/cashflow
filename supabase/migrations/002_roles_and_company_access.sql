-- Roles and multi-company access
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'cliente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'consultor', 'cliente'));
  END IF;
END;
$$;

ALTER TABLE public.users
  ALTER COLUMN company_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_company_access (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW(),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_company_access_company ON public.user_company_access(company_id);

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT COALESCE(u.role, 'cliente')
  FROM public.users u
  WHERE u.id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_access_company(p_company_id uuid)
RETURNS boolean AS $$
DECLARE
  v_role text;
  v_company_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_company_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, company_id
  INTO v_role, v_company_id
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_role = 'cliente' THEN
    RETURN v_company_id = p_company_id;
  END IF;

  IF v_role = 'consultor' THEN
    IF v_company_id = p_company_id THEN
      RETURN TRUE;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = p_company_id
    );
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Ensure all current users are treated as company clients
UPDATE public.users
SET role = 'cliente'
WHERE role IS NULL;

-- RLS
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- Replace policies
DROP POLICY IF EXISTS companies_select_policy ON public.companies;
CREATE POLICY companies_select_policy
ON public.companies FOR SELECT
USING (public.can_access_company(id));

DROP POLICY IF EXISTS companies_update_policy ON public.companies;
CREATE POLICY companies_update_policy
ON public.companies FOR UPDATE
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS users_select_policy ON public.users;
CREATE POLICY users_select_policy
ON public.users FOR SELECT
USING (id = auth.uid() OR (company_id IS NOT NULL AND public.can_access_company(company_id)));

DROP POLICY IF EXISTS users_update_policy ON public.users;
CREATE POLICY users_update_policy
ON public.users FOR UPDATE
USING (id = auth.uid() OR public.get_current_user_role() = 'admin')
WITH CHECK (id = auth.uid() OR public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS users_insert_policy ON public.users;
CREATE POLICY users_insert_policy
ON public.users FOR INSERT
WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');

DROP POLICY IF EXISTS user_company_access_select_policy ON public.user_company_access;
CREATE POLICY user_company_access_select_policy
ON public.user_company_access FOR SELECT
USING (user_id = auth.uid() OR public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS user_company_access_insert_policy ON public.user_company_access;
CREATE POLICY user_company_access_insert_policy
ON public.user_company_access FOR INSERT
WITH CHECK (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS user_company_access_delete_policy ON public.user_company_access;
CREATE POLICY user_company_access_delete_policy
ON public.user_company_access FOR DELETE
USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS bank_accounts_all_policy ON public.bank_accounts;
CREATE POLICY bank_accounts_all_policy
ON public.bank_accounts FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

DROP POLICY IF EXISTS categories_all_policy ON public.categories;
CREATE POLICY categories_all_policy
ON public.categories FOR ALL
USING (public.can_access_company(company_id))
WITH CHECK (public.can_access_company(company_id));

DROP POLICY IF EXISTS statements_all_policy ON public.statements;
CREATE POLICY statements_all_policy
ON public.statements FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.bank_accounts ba
    WHERE ba.id = statements.account_id
      AND public.can_access_company(ba.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.bank_accounts ba
    WHERE ba.id = statements.account_id
      AND public.can_access_company(ba.company_id)
  )
);

DROP POLICY IF EXISTS transactions_all_policy ON public.transactions;
CREATE POLICY transactions_all_policy
ON public.transactions FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.statements s
    JOIN public.bank_accounts ba ON ba.id = s.account_id
    WHERE s.id = transactions.statement_id
      AND public.can_access_company(ba.company_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.statements s
    JOIN public.bank_accounts ba ON ba.id = s.account_id
    WHERE s.id = transactions.statement_id
      AND public.can_access_company(ba.company_id)
  )
);
