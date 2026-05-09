-- Example tenant
INSERT INTO public.companies (id, name, cnpj)
VALUES ('11111111-1111-1111-1111-111111111111', 'Empresa Demo LTDA', '12.345.678/0001-95')
ON CONFLICT (id) DO NOTHING;

-- Example categories
INSERT INTO public.categories (company_id, name, type, color, keywords)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Recebimentos PIX', 'income', '#1D9E75', ARRAY['PIX', 'REM:']),
  ('11111111-1111-1111-1111-111111111111', 'Tarifas Bancarias', 'expense', '#E24B4A', ARRAY['TARIFA', 'CUSTO']),
  ('11111111-1111-1111-1111-111111111111', 'Folha de Pagamento', 'expense', '#BA7517', ARRAY['SALARIO', 'FOLHA'])
ON CONFLICT DO NOTHING;
