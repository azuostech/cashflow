# CashFlow Analyzer

Aplicacao web multi-tenant para analise de fluxo de caixa empresarial com upload de extratos OFX, categorizacao automatica e exportacao de relatorios.

## Stack

- Next.js 14 (App Router) + TypeScript strict
- Tailwind CSS
- Supabase (Auth, Postgres, Storage)
- React Hook Form + Zod
- Recharts
- react-dropzone
- pdf-parse
- PDFKit
- ExcelJS

## Estrutura principal

- `app/(auth)` login/cadastro
- `app/(dashboard)/dashboard` telas principais
- `app/api` rotas de autenticacao, contas, extratos, transacoes, categorias e relatorios
- `lib/parsers/ofx-parser.ts` parser de extrato OFX
- `supabase/migrations/001_initial_schema.sql` schema + RLS + RPCs

## 1. Configurar ambiente

1. Copie `.env.example` para `.env.local`
2. Preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`

## 2. Configurar Supabase

1. Crie projeto no Supabase
2. Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor
3. (Opcional) Execute `supabase/seed.sql`
4. Crie bucket de storage `statements` (privado)
5. Configure policies de storage para upload/download/delete no bucket `statements`:

```sql
insert into storage.buckets (id, name, public)
values ('statements', 'statements', false)
on conflict (id) do nothing;

create policy "statements_bucket_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'statements');

create policy "statements_bucket_select"
on storage.objects for select to authenticated
using (bucket_id = 'statements');

create policy "statements_bucket_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'statements');
```

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 4. Fluxo recomendado de uso

1. Cadastro da empresa e usuario admin
2. Cadastre a conta bancaria em `/dashboard/configuracoes`
3. Faça upload do extrato em `/dashboard/upload`
4. Revise dashboard e fluxo diario
5. Ajuste categorias e keywords em `/dashboard/categorias`
6. Exporte em `/dashboard/relatorios`

## 5. Build

```bash
npm run typecheck
npm run build
```

## 6. Deploy (Vercel)

1. Suba repo no GitHub
2. Importe no Vercel
3. Configure variaveis de ambiente do `.env.example`
4. Deploy automatico via push

## Observacoes importantes

- O sistema usa isolamento por empresa via RLS.
- `signup` cria empresa + usuario auth + perfil em `users`.
- A categorizacao automatica usa keywords das categorias da empresa.
- O parser foi preparado para layout OFX padrao (SGML com `STMTTRN`); variacoes de exportacao podem exigir ajuste.
