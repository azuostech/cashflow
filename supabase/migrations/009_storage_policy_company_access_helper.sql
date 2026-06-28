CREATE OR REPLACE FUNCTION public.cashflowai_user_has_company_access(company_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_company_roles ucr
    WHERE ucr.user_id = auth.uid()
      AND ucr.active = true
      AND ucr.company_id::text = company_id_text
  );
$$;

REVOKE ALL ON FUNCTION public.cashflowai_user_has_company_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashflowai_user_has_company_access(text) TO authenticated;

DROP POLICY IF EXISTS cashflowai_storage_select ON storage.objects;
CREATE POLICY cashflowai_storage_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN ('cashflowai-attachments', 'cashflowai-statements')
  AND public.cashflowai_user_has_company_access((storage.foldername(name))[1])
  AND (
    (
      bucket_id = 'cashflowai-attachments'
      AND (storage.foldername(name))[2] = ANY (
        ARRAY['transaction', 'installment', 'bank_move', 'bank_statement', 'contact', 'reconciliation']
      )
    )
    OR (
      bucket_id = 'cashflowai-statements'
      AND (storage.foldername(name))[2] = 'statements'
    )
  )
);

DROP POLICY IF EXISTS cashflowai_storage_insert ON storage.objects;
CREATE POLICY cashflowai_storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('cashflowai-attachments', 'cashflowai-statements')
  AND public.cashflowai_user_has_company_access((storage.foldername(name))[1])
  AND (
    (
      bucket_id = 'cashflowai-attachments'
      AND (storage.foldername(name))[2] = ANY (
        ARRAY['transaction', 'installment', 'bank_move', 'bank_statement', 'contact', 'reconciliation']
      )
    )
    OR (
      bucket_id = 'cashflowai-statements'
      AND (storage.foldername(name))[2] = 'statements'
    )
  )
);

DROP POLICY IF EXISTS cashflowai_storage_update ON storage.objects;
CREATE POLICY cashflowai_storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('cashflowai-attachments', 'cashflowai-statements')
  AND public.cashflowai_user_has_company_access((storage.foldername(name))[1])
  AND (
    (
      bucket_id = 'cashflowai-attachments'
      AND (storage.foldername(name))[2] = ANY (
        ARRAY['transaction', 'installment', 'bank_move', 'bank_statement', 'contact', 'reconciliation']
      )
    )
    OR (
      bucket_id = 'cashflowai-statements'
      AND (storage.foldername(name))[2] = 'statements'
    )
  )
)
WITH CHECK (
  bucket_id IN ('cashflowai-attachments', 'cashflowai-statements')
  AND public.cashflowai_user_has_company_access((storage.foldername(name))[1])
  AND (
    (
      bucket_id = 'cashflowai-attachments'
      AND (storage.foldername(name))[2] = ANY (
        ARRAY['transaction', 'installment', 'bank_move', 'bank_statement', 'contact', 'reconciliation']
      )
    )
    OR (
      bucket_id = 'cashflowai-statements'
      AND (storage.foldername(name))[2] = 'statements'
    )
  )
);

DROP POLICY IF EXISTS cashflowai_storage_delete ON storage.objects;
CREATE POLICY cashflowai_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('cashflowai-attachments', 'cashflowai-statements')
  AND public.cashflowai_user_has_company_access((storage.foldername(name))[1])
  AND (
    (
      bucket_id = 'cashflowai-attachments'
      AND (storage.foldername(name))[2] = ANY (
        ARRAY['transaction', 'installment', 'bank_move', 'bank_statement', 'contact', 'reconciliation']
      )
    )
    OR (
      bucket_id = 'cashflowai-statements'
      AND (storage.foldername(name))[2] = 'statements'
    )
  )
);
