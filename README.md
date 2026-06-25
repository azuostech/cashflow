# CashFlowAI

Aplicacao Next.js para gestao financeira multiempresa, importacao de extratos, conciliacao bancaria, lancamentos, anexos, auditoria e relatorios.

## Stack

- Next.js 14 App Router
- TypeScript strict
- Prisma + PostgreSQL/Supabase
- Supabase Auth e Storage
- Tailwind CSS
- Vitest

## Desenvolvimento

```bash
npm install
npm run dev
```

App local:

```text
http://localhost:3000
```

## Variaveis de ambiente

Copie `.env.example` para `.env.local` e configure:

```text
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
```

Importante: se a senha do banco tiver caracteres especiais (`@`, `#`, `]`, etc.), use a senha percent-encoded dentro de `DATABASE_URL` e `DIRECT_URL`.

## Scripts

```bash
npm run typecheck
npm run test
npm run build
npm run lint
```

## Banco

Schema Prisma:

```text
prisma/schema.prisma
```

RLS adicional da conciliacao bancaria:

```text
supabase/migrations/006_reconciliation_rls.sql
```

## Deploy

O projeto esta pronto para deploy como app raiz em GitHub/Vercel. Configure as variaveis de ambiente acima no Vercel antes do deploy de producao.
