ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliations_via_role ON public.reconciliations;
CREATE POLICY reconciliations_via_role
ON public.reconciliations
FOR ALL
USING (
  company_id IN (
    SELECT company_id
    FROM public.user_company_roles
    WHERE user_id = auth.uid()
      AND active = true
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id
    FROM public.user_company_roles
    WHERE user_id = auth.uid()
      AND active = true
  )
);

ALTER TABLE public.reconciliation_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recon_suggestions_via_role ON public.reconciliation_suggestions;
CREATE POLICY recon_suggestions_via_role
ON public.reconciliation_suggestions
FOR ALL
USING (
  company_id IN (
    SELECT company_id
    FROM public.user_company_roles
    WHERE user_id = auth.uid()
      AND active = true
  )
)
WITH CHECK (
  company_id IN (
    SELECT company_id
    FROM public.user_company_roles
    WHERE user_id = auth.uid()
      AND active = true
  )
);
