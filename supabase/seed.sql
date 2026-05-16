-- Example tenant
INSERT INTO public.companies (id, name, cnpj)
VALUES ('11111111-1111-1111-1111-111111111111', 'Empresa Demo LTDA', '12.345.678/0001-95')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.companies (id, name, cnpj)
VALUES ('22222222-2222-2222-2222-222222222222', 'Comercio Exemplo SA', '98.765.432/0001-10')
ON CONFLICT (id) DO NOTHING;

-- Example categories
INSERT INTO public.categories (company_id, name, type, color, keywords)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Recebimentos PIX', 'income', '#1D9E75', ARRAY['PIX', 'REM:']),
  ('11111111-1111-1111-1111-111111111111', 'Tarifas Bancarias', 'expense', '#E24B4A', ARRAY['TARIFA', 'CUSTO']),
  ('11111111-1111-1111-1111-111111111111', 'Folha de Pagamento', 'expense', '#BA7517', ARRAY['SALARIO', 'FOLHA'])
ON CONFLICT DO NOTHING;

INSERT INTO public.categories (company_id, name, type, color, keywords)
VALUES
  ('22222222-2222-2222-2222-222222222222', 'Vendas Cartao', 'income', '#378ADD', ARRAY['CREDITO', 'DEBITO']),
  ('22222222-2222-2222-2222-222222222222', 'Impostos', 'expense', '#993556', ARRAY['ISS', 'DARF'])
ON CONFLICT DO NOTHING;

-- Exemplo de atribuicao de consultor (substitua pelo UUID real do usuario):
-- INSERT INTO public.users (id, email, full_name, role, company_id, password_hash)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'consultor@demo.com', 'Consultor Demo', 'consultor', NULL, '')
-- ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
--
-- INSERT INTO public.user_company_access (user_id, company_id)
-- VALUES
--   ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111'),
--   ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222')
-- ON CONFLICT DO NOTHING;
