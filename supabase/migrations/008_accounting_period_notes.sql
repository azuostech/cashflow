ALTER TABLE public.accounting_periods
ADD COLUMN IF NOT EXISTS notes text;
