# Handoff - CashFlowAI como projeto raiz

## Atualizacao mais recente - Etapa 07

Etapa 07 implementada na raiz do projeto. Entrega DRE, Fluxo de Caixa, exportacao Excel e Dias de Caixa como metrica central.

Arquivos principais:

- `lib/reports/dre.ts`
- `lib/reports/cashflow.ts`
- `lib/exports/dre-excel.ts`
- `lib/reports/dre.test.ts`
- `lib/reports/cashflow.test.ts`
- `app/api/reports/dre/route.ts`
- `app/api/reports/dre/export/route.ts`
- `app/api/reports/cashflow/route.ts`
- `app/(app)/reports/dre/page.tsx`
- `app/(app)/reports/cashflow/page.tsx`

Comportamento entregue:

- DRE calcula por `competenceDate` e `convertedAmount`.
- Fluxo de Caixa calcula realizados por `paymentDate` e previstos por `dueDate`.
- Parcelas pendentes entram na projecao do fluxo.
- DRE retorna arvore hierarquica, subtotais S1-S5 e comparativo opcional com `compareValue`/`delta`.
- Export DRE gera `.xlsx` em `/api/reports/dre/export`.
- Tela `/reports/dre` tem visao executiva/tecnica, comparativo MoM, filtro por centro de custo, expansao de categorias e exportacao Excel.
- Tela `/reports/cashflow` exibe Dias de Caixa, KPIs de realizados/previstos, timeline semanal e destaque de risco de caixa.

Verificacoes executadas na raiz:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- Typecheck: OK.
- Testes: 15 arquivos, 135 testes passando.
- Lint: OK.
- Build: OK.

Observacao operacional: as rotas dependem do Prisma/Postgres. A `DATABASE_URL` atual ainda aponta para host Supabase que nao resolve no DNS; com dados reais, corrigir `DATABASE_URL`/`DIRECT_URL` continua necessario.

---

## Historico - migracao de estrutura

O projeto `cashflowai/` foi promovido para a raiz do repositorio em 2026-06-24/25. O legado anterior da raiz foi substituido por completo no working tree, preservando apenas:

- `.git`
- `.env.local`
- `CLAUDE_HANDOFF.md`

Backup temporario do estado anterior da raiz:

```text
/private/tmp/CashFlow-root-before-cashflowai-2026-06-25T02-02-00-460Z
```

O diretorio `cashflowai/` foi removido depois da copia. A aplicacao principal agora vive diretamente em:

```text
app/
components/
hooks/
lib/
prisma/
supabase/
middleware.ts
package.json
```

## Deploy raiz

Repositorio:

```text
https://github.com/azuostech/cashflow.git
branch: main
```

Para Vercel, o projeto agora deve ser configurado com:

```text
Framework Preset: Next.js
Root Directory: ./
Build Command: npm run build
Install Command: npm install
Output Directory: .next
```

Variaveis necessarias em producao:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Importante: `DATABASE_URL` e `DIRECT_URL` precisam ter senha percent-encoded se houver caracteres especiais. O `.env.local` da raiz foi ajustado localmente para esse formato sem imprimir segredos.

## Verificacoes apos migracao para raiz

Executado na raiz:

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run lint
```

Resultado ate aqui:

- `npm install`: OK, com 14 vulnerabilidades reportadas pelo `npm audit` (nao foi usado `audit fix --force`).
- `npm run typecheck`: OK.
- `npm run test`: OK, 13 arquivos e 119 testes passando.
- `npm run build`: OK, com warning nao-fatal do `@supabase/ssr` no Edge Runtime do middleware.
- `npm run lint`: OK.

## Pendencias apos migracao

- GitHub concluido: commit `f18f7a2` (`feat: promote CashFlowAI app to repository root`) enviado para `origin/main`.
- Confirmar deploy Vercel. Se o repo ja estiver conectado na Vercel, o push em `main` deve disparar deploy automatico.
- Deploy Vercel via CLI nao foi disparado neste ambiente porque nao existe `.vercel/`, `vercel.json`, CLI `vercel` instalada ou `VERCEL_TOKEN` disponivel. Para disparar manualmente, conectar/importar o repo na Vercel ou rodar Vercel CLI autenticado.
- Aplicar no Supabase remoto a migration `supabase/migrations/006_reconciliation_rls.sql`.
  - Tentativa anterior via `psql` falhou por DNS do host Supabase neste ambiente.
- Correcao de runtime no dashboard: se o Prisma nao conseguir conectar ao Postgres, `/dashboard` renderiza aviso de banco indisponivel em vez de cair no overlay vermelho do Next. O host atual `db.vrbnbjxyqouvbqgpflqp.supabase.co` nao resolve no DNS; ainda e necessario substituir `DATABASE_URL`/`DIRECT_URL` pelas strings corretas do projeto Supabase.

---

# Handoff historico - CashFlowAI Etapa 06

## Atualizacao mais recente

Etapa 06 foi originalmente implementada no subprojeto `cashflowai/`. Depois disso, o subprojeto foi promovido para a raiz conforme registrado acima.

## Arquivos principais da etapa

- `cashflowai/lib/matching/engine.ts`: motor de matching com score por valor, data, documento e descricao; threshold minimo 0.60; retorna apenas confidence label para consumo externo.
- `cashflowai/lib/matching/engine.test.ts`
- `cashflowai/lib/matching/scoring.test.ts`
- `cashflowai/app/api/bank/moves/route.ts`
- `cashflowai/app/api/bank/moves/[id]/suggestions/route.ts`
- `cashflowai/app/api/bank/moves/[id]/ignore/route.ts`
- `cashflowai/app/api/bank/moves/[id]/create-transaction/route.ts`
- `cashflowai/app/api/bank/reconciliation/route.ts`
- `cashflowai/app/api/bank/reconciliation/[id]/unreconcile/route.ts`
- `cashflowai/components/bank/bank-move-card.tsx`
- `cashflowai/components/bank/suggestion-card.tsx`
- `cashflowai/app/(app)/bank/reconciliation/page.tsx`
- `cashflowai/supabase/migrations/006_reconciliation_rls.sql`

## Comportamento implementado

- Zero conciliacao automatica: o motor apenas sugere; conciliacao exige POST explicito do usuario.
- Score numerico nao e exposto pela API de sugestoes nem pela UI; a resposta publica usa `confidence: high | medium | low`.
- Sugestoes sao persistidas em `reconciliation_suggestions`; sugestoes pendentes antigas sao expiradas ao recalcular.
- `POST /api/bank/reconciliation` cria `Reconciliation`, atualiza `BankMove`, `Transaction` ou `Installment`, e audita a acao.
- Receitas conciliadas seguem o padrao local `received`; despesas usam `paid`.
- Conciliacao de parcela recalcula o status de conciliacao do lancamento pai como `unreconciled`, `partial` ou `reconciled`.
- `POST /api/bank/moves/[id]/create-transaction` cria o lancamento pago/recebido a partir do extrato e ja cria a reconciliacao.
- `POST /api/bank/moves/[id]/ignore` alterna `ignored` e `unreconciled`.
- `POST /api/bank/reconciliation/[id]/unreconcile` exige `owner` ou `admin`, justificativa minima e gera audit log.
- Tela `/bank/reconciliation` substitui placeholder por split screen com filtros, lista de movimentos, sugestoes e modal de criacao de lancamento.

## Verificacoes executadas

Dentro de `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run build
npm run lint
```

Resultado:

- Typecheck: OK
- Testes: 13 arquivos, 119 testes passando
- Build: OK
- Lint: sem warnings ou erros

Observacao: o primeiro teste da etapa baseado no prompt foi ajustado porque, com os pesos definidos, valor exato + mesma data + CNPJ soma 0.85. Para atingir alta confianca (`>= 0.90`), o cenario tambem precisa de descricao similar.

## Pendencias operacionais

- Aplicar no Supabase remoto a migration `cashflowai/supabase/migrations/006_reconciliation_rls.sql`.
  - Tentativa via `psql` foi feita, mas bloqueou em DNS: o host `db.vrbnbjxyqouvbqgpflqp.supabase.co` nao resolveu neste ambiente.
- Validar manualmente o fluxo com dados reais: importar extrato, abrir `/bank/reconciliation`, aceitar sugestao, criar lancamento a partir do movimento, ignorar movimento e desconciliar com justificativa.
- O repositorio raiz ja estava com `cashflowai/` e `CLAUDE_HANDOFF.md` como nao rastreados antes desta etapa; nao houve limpeza/reversao desse estado.

---

# Handoff legado preservado - CashFlow Analyzer

## Contexto rapido

Aplicacao web multi-tenant para analise de fluxo de caixa empresarial. O fluxo principal e:

1. usuario/empresa fazem login;
2. cadastram contas bancarias;
3. enviam extratos OFX;
4. o sistema importa transacoes, calcula saldos, categoriza por keywords;
5. dashboard, fluxo diario e relatorios exibem os dados.

Repo local:

```text
/Users/jacksonsouza/azuos_projects/CashFlow
```

Repositorio remoto:

```text
https://github.com/azuostech/cashflow.git
branch: main
```

Commits recentes relevantes:

```text
fde3686 fix: preserve bank statement dates in display
cd0ff72 feat: filter statement upload by bank
9c92736 fix: default daily/dashboard analysis to latest imported statement period
98fe165 feat: add admin company and company-user management
1c78cf5 feat(fluxo-diario): permitir desabilitar lancamentos no total
d9edee1 feat: initial cashflow analyzer implementation
```

## Stack

- Next.js 14 App Router
- TypeScript strict
- React 18
- Tailwind CSS
- Supabase Auth, Postgres, Storage
- Recharts
- react-dropzone
- pdf-parse, PDFKit, ExcelJS
- Zod

Scripts:

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run lint
```

Observacao: `npm run lint` ainda cai no setup interativo do Next ESLint porque o projeto nao tem config ESLint finalizada. `npm run typecheck` passou apos as ultimas mudancas.

## Variaveis e ambiente

Existe `.env.local`, mas nao incluir segredos em prompts. Variaveis esperadas:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
```

Migrations:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_roles_and_company_access.sql
```

Bucket Supabase esperado:

```text
statements
```

## Estrutura importante

Telas:

```text
app/(auth)/login/page.tsx
app/(auth)/cadastro/page.tsx
app/(dashboard)/dashboard/page.tsx
app/(dashboard)/dashboard/fluxo-diario/page.tsx
app/(dashboard)/dashboard/upload/page.tsx
app/(dashboard)/dashboard/configuracoes/page.tsx
app/(dashboard)/dashboard/categorias/page.tsx
app/(dashboard)/dashboard/relatorios/page.tsx
app/(dashboard)/dashboard/empresas/page.tsx
app/(dashboard)/dashboard/empresas/[companyId]/usuarios/page.tsx
```

APIs:

```text
app/api/statements/upload/route.ts
app/api/statements/list/route.ts
app/api/statements/[id]/route.ts
app/api/reports/daily/route.ts
app/api/reports/dashboard/route.ts
app/api/reports/export-pdf/route.ts
app/api/reports/export-excel/route.ts
app/api/accounts/list/route.ts
app/api/accounts/[id]/route.ts
app/api/transactions/list/route.ts
app/api/transactions/[id]/route.ts
app/api/transactions/categorize/route.ts
app/api/categories/list/route.ts
```

Bibliotecas internas:

```text
lib/parsers/ofx-parser.ts
lib/parsers/bradesco-parser.ts
lib/categorization.ts
lib/reports.ts
lib/auth.ts
lib/supabase/server.ts
lib/supabase/client.ts
lib/supabase/admin.ts
lib/utils/format.ts
lib/utils/date.ts
```

Componentes relevantes:

```text
components/upload/DropZone.tsx
components/upload/UploadPreview.tsx
components/transactions/TransactionRow.tsx
components/dashboard/EvolutionChart.tsx
components/dashboard/MonthlyComparisonChart.tsx
components/dashboard/MonthlySummaryList.tsx
components/layout/Header.tsx
components/layout/Sidebar.tsx
components/layout/SessionControls.tsx
```

## Modelo de dados resumido

Tabelas principais:

- `companies`: empresas.
- `users`: usuarios internos vinculados a empresa ou consultoria/admin.
- `user_company_access`: vinculo consultor/admin com empresas.
- `bank_accounts`: contas bancarias por empresa.
- `statements`: uploads/importacoes de extratos.
- `transactions`: transacoes importadas.
- `categories`: categorias e keywords.

Seguranca:

- RLS ativado nas tabelas principais.
- `cliente`: acessa propria empresa.
- `consultor`: acessa empresas em `user_company_access`.
- `admin`: acessa todas.

Sessao:

- `getSessionContext()` em `lib/auth.ts` resolve usuario, role e empresa ativa.
- APIs normalmente exigem `session.companyId`.
- Admin/consultor podem alternar empresa ativa via rotas de session.

## Fluxo de upload OFX

Arquivo principal:

```text
app/api/statements/upload/route.ts
```

Fluxo:

1. valida sessao e empresa ativa;
2. recebe `file` e `accountId`;
3. valida que a conta pertence a empresa;
4. chama `parseOFX(buffer, { expectedBankName, expectedAccountNumber })`;
5. salva arquivo no bucket `statements`;
6. cria registro em `statements`;
7. categoriza cada transacao via `categorizeTransaction`;
8. insere em `transactions`;
9. marca statement como `completed`.

Tela:

```text
app/(dashboard)/dashboard/upload/page.tsx
```

Mudanca recente:

- Antes havia apenas seletor de conta.
- Agora ha seletor de banco e depois seletor de conta filtrado por banco.
- Historico de uploads respeita banco/conta selecionados.
- API retorna `bank` e `warnings` detectados pelo parser.

## Parser OFX atual

Arquivo:

```text
lib/parsers/ofx-parser.ts
```

Comportamento atual:

- Le OFX SGML com blocos `<STMTTRN>`.
- Decodifica em UTF-8 ou latin1, escolhendo a versao com menos caracteres de substituicao.
- Aceita valores com virgula ou ponto decimal.
- Extrai:
  - `BANKID`
  - `ACCTID`
  - `ACCTTYPE`
  - `DTPOSTED`
  - `TRNAMT`
  - `TRNTYPE`
  - `FITID`
  - `CHECKNUM`
  - `MEMO`
  - `LEDGERBAL/BALAMT`
- Identifica bancos por codigo:
  - `001` Banco do Brasil
  - `033` Santander
  - `077` Inter
  - `104` Caixa
  - `237` Bradesco
  - `260` Nubank
  - `341` Itau
  - `748` Sicredi
- Tambem tenta identificar pelo nome cadastrado.
- Gera warnings se banco/conta do OFX divergirem da conta selecionada.
- Ignora transacoes de saldo como:
  - `SALDO ANTERIOR`
  - `SALDO DO DIA`
  - `SALDO FINAL`
  - `SALDO TOTAL DISPONIVEL DIA`
- Usa `DTPOSTED` como data da transacao.
- Calcula `balanceAfter` reconstruindo a partir do saldo final (`LEDGERBAL/BALAMT`) e soma liquida das transacoes.

Ponto critico:

- Alguns bancos exportam `DTPOSTED` como data contabil/postagem, enquanto a data operacional aparece dentro do `MEMO`.
- No Bradesco testado, ha casos de fim de semana em que o memo diz `07/06`, mas `DTPOSTED` e `08/06`.
- O app atualmente armazena apenas uma data (`transactions.date`), entao nao diferencia `postedDate` vs `operationDate`.

## Parser PDF Bradesco

Arquivo:

```text
lib/parsers/bradesco-parser.ts
```

Status:

- Existe parser PDF usando `pdf-parse`.
- Nao esta integrado ao upload atual, que aceita OFX.
- No PDF real testado do Bradesco, a extracao textual ficou ruim: linhas/colunas vieram coladas e o parser produziu valores absurdos.
- PDF e util como referencia visual/manual, mas nao e confiavel ainda para importacao automatica sem um parser bem mais robusto.

## Arquivos reais usados na analise recente

OFX Bradesco:

```text
/Users/jacksonsouza/Library/CloudStorage/GoogleDrive-jksouza@gmail.com/My Drive/Pessoal/Ville capital AAI/Clientes/Pamella & Maycon/extratos/OFX/Bradesco_maio 26.OFX
```

PDF Bradesco:

```text
/Users/jacksonsouza/Library/CloudStorage/GoogleDrive-jksouza@gmail.com/My Drive/Pessoal/Ville capital AAI/Clientes/Pamella & Maycon/extratos/OFX/Bradesco_08052026_170818.PDF
```

OFX informado como Banco do Brasil:

```text
/Users/jacksonsouza/Library/CloudStorage/GoogleDrive-jksouza@gmail.com/My Drive/Pessoal/Ville capital AAI/Clientes/Telma Holanda/Extratos/OFX/BancoBrasil_abril_Extrato_160200195438_14-05-2026_Parte1.ofx
```

Observacao importante: esse arquivo chamado BancoBrasil tem `<BANKID>0341`, que e Itau. O sistema detecta isso e devolve warning.

## Resultado da comparacao OFX x PDF Bradesco

Comparacao no intervalo em comum do PDF emitido em `08/05/2026 17h08`:

```text
04/05/2026:
PDF +1.600,00
OFX +1.600,00

05/05/2026:
PDF liquido +12.227,02
OFX liquido +12.227,02

06/05/2026:
PDF -9.791,38
OFX -9.791,38

07/05/2026:
PDF -3.494,34
OFX -3.494,34

08/05/2026:
PDF mostra +486,00 ate 17h08
OFX mostra +1.844,00 no dia completo
```

Conclusao da comparacao:

- OFX e melhor para importacao automatica.
- PDF e melhor para conferencia visual/manual.
- A divergencia em 08/05 ocorre porque o PDF foi emitido antes do fim do dia.
- O "D+1" observado em alguns lancamentos vem do proprio OFX/Bradesco em casos de compensacao/postagem. Exemplo: memo `07/06`, `DTPOSTED` `08/06`.

## Bug de data corrigido recentemente

Problema:

- Algumas telas formatavam datas `YYYY-MM-DD` com `new Date(value).toLocaleDateString('pt-BR')`.
- Em fusos como Brasil, `new Date('YYYY-MM-DD')` pode interpretar UTC e exibir o dia anterior.

Correcao no commit `fde3686`:

- Criado `formatDateBR()` em `lib/utils/format.ts`, que formata `YYYY-MM-DD` sem conversao de timezone.
- Aplicado em:
  - `components/transactions/TransactionRow.tsx`
  - `app/(dashboard)/dashboard/fluxo-diario/page.tsx`
  - `app/(dashboard)/dashboard/upload/page.tsx`

## Pontos que Claude deve analisar com prioridade

1. **Saldo por dia / balanceAfter**
   - Hoje `balanceAfter` e reconstruido a partir de `LEDGERBAL/BALAMT`.
   - Para alguns bancos, o saldo final do OFX pode nao representar o mesmo saldo operacional do PDF/periodo parcial.
   - Verificar se o app deveria armazenar saldo exatamente do arquivo quando existir, ou recalcular por statement, ou nao confiar em `balanceAfter` de OFX sem saldo por transacao.

2. **Data contabil vs data operacional**
   - Hoje existe apenas `transactions.date`.
   - Sugestao: adicionar `posted_date` e `operation_date` no schema, ou ao menos guardar `metadata`/`raw_memo_date`.
   - Para Bradesco, `DTPOSTED` parece data contabil; memo pode conter data operacional.

3. **Parser bank-specific**
   - O parser ja identifica banco, mas ainda tem poucas regras especificas.
   - Pode evoluir para estrategias:
     - Bradesco
     - Banco do Brasil
     - Sicredi
     - Inter
     - Nubank
     - Itau
   - Cada estrategia decide:
     - data preferida;
     - lancamentos de saldo a ignorar;
     - normalizacao de descricao;
     - validacao de conta/agencia;
     - calculo de saldo.

4. **Testes automatizados com fixtures**
   - Criar pasta `test/fixtures/ofx` ou similar.
   - Adicionar testes para:
     - Bradesco com virgula decimal;
     - Itau/BancoBrasil-nomeado com ponto decimal e `SALDO TOTAL DISPONIVEL DIA`;
     - encoding UTF-8 vs latin1;
     - warnings de banco/conta divergente;
     - datas que aparecem no memo diferente de `DTPOSTED`.
   - O projeto ainda nao tem runner de testes configurado.

5. **PDF**
   - Nao usar PDF como fonte automatica sem melhorar muito o parser.
   - Se PDF for necessario, considerar `pdfplumber`/OCR/layout-aware parser fora do runtime atual, ou extração por coordenadas caso layout seja estável.

6. **Duplicidade de uploads**
   - Verificar se existe protecao suficiente contra importar o mesmo OFX duas vezes.
   - Hoje nao ha uma constraint clara por `statement_id/date/document_number/amount/description` nem hash de arquivo.

7. **Relatorios e selecao de periodo**
   - APIs relevantes:
     - `app/api/reports/daily/route.ts`
     - `app/api/reports/dashboard/route.ts`
   - Recentemente o dashboard/fluxo passou a usar o periodo do ultimo statement importado.
   - Validar se isso faz sentido quando ha multiplas contas/bancos.

## Comandos uteis de verificacao

```bash
npm run typecheck
npm run build
git status --short
git log --oneline -8
```

Para rodar localmente:

```bash
npm run dev
# ou, se precisar forcar host local:
npm run dev -- -H 127.0.0.1 -p 3000
```

## Estado atual conhecido

- Branch `main` estava limpa apos os ultimos commits.
- Ultimos pushes feitos para `origin/main`:
  - `cd0ff72 feat: filter statement upload by bank`
  - `fde3686 fix: preserve bank statement dates in display`
- `npm run typecheck` passou.
- `npm run lint` nao passou por falta de configuracao, caiu no prompt interativo do Next.

## Pedido sugerido para Claude

Use este prompt:

```text
Analise esta aplicacao Next.js/Supabase chamada CashFlow Analyzer. Quero uma auditoria tecnica focada em importacao de extratos bancarios, principalmente OFX vs PDF, datas de lancamento, saldos diarios e diferencas por banco.

Priorize:
1. revisar lib/parsers/ofx-parser.ts;
2. revisar app/api/statements/upload/route.ts;
3. revisar app/api/reports/daily/route.ts e dashboard;
4. propor schema/implementacao para separar data contabil (DTPOSTED) de data operacional do memo;
5. propor como corrigir balanceAfter e saldos diarios quando o OFX nao traz saldo por transacao;
6. sugerir testes automatizados com fixtures reais anonimizadas;
7. apontar riscos de duplicidade, timezone, RLS e multi-conta.

Nao inclua segredos de .env.local. Se precisar usar fixtures, anonimizar nomes/documentos.
```

---

## Atualizacao 2026-06-21 - CashFlowAI Etapa 01

Foi implementada a fundacao paralela do CashFlowAI em:

```text
cashflowai/
```

Decisao importante:

- A etapa foi criada como subprojeto Next.js isolado dentro do repo, em vez de sobrescrever `app/`, `lib/`, `components/` e `middleware.ts` da raiz.
- Motivo: o prompt da etapa cria rotas como `/dashboard`, `/login`, `lib/auth.ts`, `lib/utils/date.ts` e `components/layout/sidebar.tsx`, que colidiriam com o CashFlow Analyzer legado e poderiam quebrar o produto atual.
- O legado nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Arquivos/areas criadas:

```text
cashflowai/package.json
cashflowai/app
cashflowai/components
cashflowai/lib
cashflowai/prisma
cashflowai/middleware.ts
cashflowai/vitest.config.ts
cashflowai/.env.example
```

Entregas principais:

- App Next.js 14 App Router com TypeScript strict e Tailwind.
- Estrutura de rotas da Etapa 01 em `app/(auth)`, `app/(app)` e `app/api`.
- Layout autenticado com sidebar escura, header, breadcrumb dinamico, seletor de periodo e botao de novo lancamento.
- Layout auth e placeholders funcionais para todas as paginas da etapa.
- APIs pendentes implementadas como handlers 501, para evitar `route.ts` vazio quebrando build.
- `GET /api/health` implementado com Prisma e marcado como `force-dynamic`, evitando consulta ao banco durante build.
- Prisma completo em `cashflowai/prisma/schema.prisma`.
- Seed idempotente em `cashflowai/prisma/seed.ts` para moedas, bank providers globais e DRE nodes globais.
- Libs base:
  - `lib/prisma.ts`
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
  - `lib/session.ts`
  - `lib/auth.ts`
  - `lib/utils/*`
  - `lib/validations/*`
  - `lib/utils/audit.ts`
- Componentes UI base em `components/ui`.
- Testes Vitest para CNPJ e normalizacao de descricao.

Ajustes tecnicos feitos para manter o codigo compilavel:

- O schema original do prompt tinha backrefs Prisma para anexos polimorficos (`Transaction.attachments`, `BankMove.attachments`, etc.), mas `Attachment` usa `entityType/entityId`. Prisma nao suporta relacao polimorfica com backrefs automaticos. Foram removidos apenas esses backrefs invalidos, mantendo `Attachment` como tabela polimorfica.
- Foi adicionada a relacao `Company.bankMoves` porque `BankMove.company` precisa de lado oposto no Prisma.
- O seed do prompt usava `upsert` por `id: p.name` em `BankProvider`, mas `id` e UUID. Foi trocado por `findFirst + update/create`.
- O script `lint` ficou como `next lint`; `next lint --no-fix` falhou nesta versao do Next com `unknown option '--no-fix'`.

Verificacoes executadas em `cashflowai/`:

```bash
npm install
npx prisma generate
npm run typecheck
npm run test
npm run build
npm run lint
```

Resultado:

- `npx prisma generate`: passou.
- `npm run typecheck`: passou.
- `npm run test`: passou, 2 arquivos e 9 testes.
- `npm run build`: passou.
- `npm run lint`: passou, sem warnings ou erros.

Nao executado por seguranca:

```bash
npx prisma db push
npx prisma db seed
```

Motivo:

- O subprojeto ainda nao possui `cashflowai/.env.local`.
- Nao usar o banco legado da raiz para aplicar o schema novo. Isso poderia alterar o banco do CashFlow Analyzer atual.
- Antes de rodar `db push`/`db seed`, criar/configurar um projeto Supabase separado para o CashFlowAI e preencher:

```text
DATABASE_URL
DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

Observacoes:

- `npm install` reportou 13 vulnerabilidades no grafo novo. Nao foi executado `npm audit fix --force`, porque isso pode alterar major versions e quebrar a fundacao recem-validada.
- O app novo pode ser rodado com:

```bash
cd cashflowai
npm run dev
```

Proxima etapa recomendada:

1. Criar Supabase separado para CashFlowAI.
2. Preencher `cashflowai/.env.local`.
3. Rodar `npm run db:push`.
4. Rodar `npm run db:seed`.
5. Testar `GET /api/health` com o servidor local.
6. So depois iniciar Etapa 02 - Auth + Onboarding.

---

## Atualizacao 2026-06-22 - CashFlowAI Etapa 02

Foi implementada a Etapa 02 no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Entregas principais:

- Dependencias adicionadas:
  - `react-hook-form`
  - `@hookform/resolvers`
- Schemas Zod:
  - `lib/validations/auth.schema.ts`
  - `lib/validations/onboarding.schema.ts`
- Paginas reais de autenticacao:
  - `/login`
  - `/register`
  - `/forgot-password`
  - `/reset-password`
  - `/invite/[token]`
- Onboarding guiado em `/onboarding` com 4 passos:
  - empresa
  - contas bancarias, com opcao de pular
  - centros de custo obrigatorios
  - categorias obrigatorias, incluindo categoria personalizada com DRENode
- APIs implementadas:
  - `POST/GET /api/companies`
  - `POST/GET /api/bank-accounts`
  - `POST/GET /api/cost-centers`
  - `POST/GET /api/categories`
  - `GET /api/dre-nodes`
  - `GET /api/bank-providers`
  - `POST /api/invites/accept`
  - `GET /api/onboarding/status`
- `middleware.ts` atualizado para novas rotas publicas e para separar rotas guest-only das rotas acessiveis por usuario logado.
- `/dashboard` deixou de ser placeholder e agora valida onboarding antes de renderizar.
- Testes adicionados para schemas de auth e onboarding.

Adaptacoes importantes ao prompt:

- O schema Prisma atual nao possui coluna `invite_token` em `user_company_roles`. Para nao criar migration fora da etapa, o aceite de convite usa o proprio `UserCompanyRole.id` como token UUID.
- Conta bancaria pode ser pulada no onboarding. Por isso, `GET /api/onboarding/status` considera o onboarding completo quando centros de custo e categorias existem, mesmo se nao houver conta bancaria.
- Os selects do prompt foram adaptados ao componente nativo existente em `components/ui/select.tsx`, em vez de importar componentes shadcn que nao existem no subprojeto.
- `POST /api/companies` faz `upsert` defensivo em `public.users` antes de criar a role owner. O trigger Supabase continua recomendado, mas isso evita falha de FK caso o trigger ainda nao tenha sido aplicado no ambiente local.
- `middleware.ts` agora deixa `/api/health` passar antes de criar cliente Supabase e tolera ausencia de `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` para rotas publicas. Isso evita 500 em `/login` quando o `.env.local` ainda nao foi configurado.

Verificacoes executadas em `cashflowai/`:

```bash
npm install react-hook-form @hookform/resolvers
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 4 arquivos e 27 testes.
- `npm run lint`: passou, sem warnings ou erros.
- `npm run build`: passou.

Verificacao local adicional:

- `npm run dev` iniciado em `http://localhost:3000`.
- `GET /login`: respondeu `200 OK`.
- `GET /api/health`: respondeu `{"ok":false,"db":"error"}` no ambiente atual, indicando que o servidor responde, mas a conexao/env de banco ainda nao esta pronta para o health ficar verde.

Ainda nao executado:

- Teste manual de `/register`, `/login`, `/forgot-password`, `/reset-password`, `/onboarding` e `/invite/[token]` com Supabase real.
- SQL manual no Supabase para trigger `handle_new_user`.
- SQL manual no Supabase para RLS da Etapa 02.

SQL manual pendente no Supabase:

- Criar/atualizar a funcao `public.handle_new_user()`.
- Criar trigger `on_auth_user_created` em `auth.users`.
- Habilitar RLS e policies de:
  - `users`
  - `companies`
  - `user_company_roles`
  - `bank_accounts`
  - `cost_centers`
  - `categories`
  - `dre_nodes`
  - `currencies`
  - `bank_providers`

Proxima etapa recomendada:

1. Aplicar trigger e RLS da Etapa 02 no SQL Editor do Supabase CashFlowAI.
2. Rodar o servidor local com `cd cashflowai && npm run dev`.
3. Testar manualmente cadastro, confirmacao de e-mail, login, recuperacao de senha e onboarding completo.
4. Criar pelo menos um convite usando `user_company_roles.id` como token na URL `/invite/{id}` ate existir uma feature propria de envio de convites.
5. Somente apos validacao manual iniciar Etapa 03 - Cadastros Base.

---

## Atualizacao 2026-06-23 - CashFlowAI Etapa 03

Foi implementada a Etapa 03 no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Entregas principais:

- Schema Zod novo:
  - `lib/validations/settings.schema.ts`
- Componentes/hooks compartilhados:
  - `components/shared/modal.tsx`
  - `components/shared/type-badge.tsx`
  - `hooks/use-fetch.ts`
- `createAuditLog()` atualizado para serializar objetos Prisma/Date/Decimal antes de gravar JSON.
- APIs CRUD/settings implementadas:
  - `GET/PATCH /api/companies/[id]`
  - `GET/PATCH/DELETE /api/bank-accounts/[id]`
  - `GET/PATCH/DELETE /api/cost-centers/[id]`
  - `GET/PATCH /api/categories/[id]`
  - `POST /api/categories/[id]/deprecate`
  - `GET/POST /api/contacts`
  - `PATCH/DELETE /api/contacts/[id]`
  - `GET /api/audit-logs`
- APIs existentes ajustadas:
  - `GET /api/companies` agora retorna campos completos da empresa.
  - `GET /api/bank-accounts?active=all` lista ativas e inativas.
  - `GET /api/cost-centers?active=all` lista ativas e inativas, com `transactionCount`.
  - `GET /api/categories?includeDeprecated=true` lista categorias depreciadas.
  - `GET /api/dre-nodes?includeSubtotals=false` filtra subtotais.
- Telas de settings substituidas por UI funcional:
  - `/settings/company`: edicao de nome, razao social, setor, porte, fiscal year e timezone.
  - `/settings/bank-accounts`: cards com criar, editar, desativar e reativar.
  - `/settings/cost-centers`: tabela com hierarquia, criar, editar, desativar e reativar.
  - `/settings/chart-of-accounts`: arvore DRENode + categorias, subcategorias, edicao e depreciacao.
  - `/settings/contacts`: tabela com busca, filtros, paginacao, criar, editar, desativar e reativar.
  - `/settings/audit`: leitura dos ultimos AuditLogs com filtro por entidade.
- Testes adicionados:
  - `lib/validations/settings.schema.test.ts`

Adaptacoes importantes ao prompt:

- Para reforcar a regra de soft delete, `DELETE` de bank accounts e contacts sempre desativa (`active=false`) em vez de deletar fisicamente, mesmo sem vinculos.
- Centros de custo tambem usam soft delete, mas bloqueiam desativacao quando existem filhos ativos ou lancamentos vinculados.
- Categorias continuam sem delete fisico; a operacao suportada e depreciacao via `deprecatedAt`.
- Reativacao foi adicionada nas telas para contas bancarias, centros de custo e contatos usando `PATCH { active: true }`.
- A tela `/settings/audit` foi implementada como leitura simples, embora o prompt ainda marque auditoria completa para etapa futura; isso ajuda a validar os AuditLogs desta etapa.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 5 arquivos e 43 testes.
- `npm run lint`: passou, sem warnings ou erros.
- `npm run build`: passou.

Ainda nao executado:

- Teste manual dos CRUDs com Supabase real, porque o ambiente local ainda depende de `.env.local`/banco configurado.
- SQL manual da Etapa 03 no Supabase.

SQL manual pendente no Supabase para Etapa 03:

- Habilitar RLS e policy de `contacts`.
- Habilitar RLS e policy de leitura de `audit_logs`.
- Criar funcao `public.prevent_audit_log_mutation()`.
- Criar trigger `audit_log_immutable` para impedir UPDATE/DELETE em `audit_logs`.

Proxima etapa recomendada:

1. Aplicar o SQL de RLS/trigger da Etapa 03 no Supabase CashFlowAI.
2. Garantir `.env.local` do `cashflowai/` com `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Rodar `cd cashflowai && npm run dev`.
4. Testar manualmente `/settings/company`, `/settings/bank-accounts`, `/settings/cost-centers`, `/settings/chart-of-accounts`, `/settings/contacts` e `/settings/audit`.
5. Conferir registros na tabela `audit_logs`.
6. Somente apos validacao manual iniciar Etapa 04 - Lancamentos.

---

## Atualizacao 2026-06-23 - CashFlowAI Etapa 04-A

Foi implementada a Etapa 04-A no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Entregas principais:

- Schema Zod de lancamentos:
  - `lib/validations/transaction.schema.ts`
- Funcoes de dominio:
  - `lib/transactions/domain.ts`
  - `distributeAmount()`
  - `createInstallments()`
  - `buildRecurrenceDates()`
  - `generateRecurrenceOccurrences()`
  - `reverseTransaction()`
  - `guardPeriod()`
  - `calcConvertedAmount()`
- APIs de lancamentos implementadas:
  - `GET/POST /api/transactions`
  - `GET/PATCH/DELETE /api/transactions/[id]`
  - `POST /api/transactions/[id]/pay`
  - `POST /api/transactions/[id]/cancel`
  - `POST /api/transactions/[id]/reverse`
  - `GET /api/transactions/[id]/installments`
  - `POST /api/transactions/[id]/installments/[installmentId]/pay`
- APIs de anexos implementadas:
  - `GET/POST /api/attachments`
  - `DELETE /api/attachments/[id]`
- Testes adicionados:
  - `lib/transactions/domain.test.ts`
  - `lib/validations/transaction.schema.test.ts`

Adaptacoes importantes ao prompt:

- `date-fns@3` ja estava instalado em `cashflowai/package.json` e em `node_modules`, entao nao foi necessario rodar novo `npm install`.
- As rotas de transaction substituem os handlers 501 existentes, mantendo o padrao local de `getSessionContext()`, `NextResponse` e `createAuditLog()`.
- As validacoes de API conferem pertencimento a empresa para categoria, centro de custo, contas bancarias, contato e entidades anexadas, evitando IDs cruzados entre tenants.
- A API de anexos usa `SUPABASE_SERVICE_ROLE_KEY` para upload no bucket privado `attachments` e valida tamanho maximo de 10 MB e MIME types permitidos.
- Pagamento parcial foi validado e rejeitado com 422 nesta etapa quando `amount` difere do valor original, porque o schema Prisma atual nao possui campo para registrar valor pago parcial sem perder informacao.
- Recorrencias sao geradas ate o horizonte de 12 meses definido no prompt. O dia do mes e ajustado para o ultimo dia valido quando o mes nao possui o dia solicitado.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run build
npm run lint
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 7 arquivos e 65 testes.
- `npm run build`: passou.
- `npm run lint`: passou, sem warnings ou erros.

Ainda nao executado:

- Criacao do bucket privado `attachments` no Supabase Storage, porque depende do painel/ambiente Supabase.
- SQL manual de RLS da Etapa 04-A no Supabase.
- Teste manual das APIs com Supabase real, porque depende de `.env.local`/banco configurado.

SQL manual pendente no Supabase para Etapa 04-A:

- Criar bucket privado `attachments` com limite de 10 MB e MIME types permitidos:
  - `image/*`
  - `application/pdf`
  - `application/vnd.ms-excel`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `text/csv`
- Criar policy `attachments_authenticated` em `storage.objects` para o bucket `attachments`.
- Habilitar RLS e criar policies para:
  - `transactions`
  - `installments`
  - `recurrence_rules`
  - `attachments`
  - `transaction_tags`
  - `tags`

Proxima etapa recomendada:

1. Aplicar o SQL de RLS da Etapa 04-A no Supabase CashFlowAI.
2. Criar o bucket privado `attachments` no Supabase Storage.
3. Garantir `.env.local` do `cashflowai/` com `SUPABASE_SERVICE_ROLE_KEY`, alem das variaveis ja usadas nas etapas anteriores.
4. Rodar `cd cashflowai && npm run dev`.
5. Testar manualmente criacao, edicao, cancelamento, pagamento, estorno, parcelas, recorrencia e anexos via API.
6. Somente apos validacao manual iniciar Etapa 04-B - UI de Lancamentos.

---

## Atualizacao 2026-06-24 - CashFlowAI Etapa 04-B

Foi implementada a Etapa 04-B no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Entregas principais:

- Componentes compartilhados de lancamentos:
  - `components/transactions/status-badge.tsx`
  - `components/transactions/transaction-type-badge.tsx`
  - `components/transactions/amount-cell.tsx`
  - `components/transactions/transaction-form.tsx`
  - `components/transactions/pay-modal.tsx`
- Componentes compartilhados de UI:
  - `components/shared/drawer.tsx`
  - `components/shared/searchable-select.tsx`
- Hook de listagem:
  - `hooks/use-transactions.ts`
- Funcoes puras para uso no cliente:
  - `lib/transactions/index.ts`
  - `generateInstallmentPreviews()`
  - `generateRecurrenceDates()`
  - `isCategoryCompatible()`
  - `calcConvertedAmount()`
- Telas implementadas:
  - `/transactions`: listagem com filtros, totais, paginacao, exportacao CSV, drawer de criar/editar, pagamento rapido, cancelamento e estorno.
  - `/payables`: despesas pendentes agrupadas por vencidas, vence hoje e proximas.
  - `/receivables`: receitas pendentes agrupadas por vencidas, vence hoje e proximas.

Adaptacoes importantes ao prompt:

- O prompt assumia `lib/transactions/index.ts` vindo da Etapa 04-A, mas a implementacao anterior tinha `lib/transactions/domain.ts` com Prisma. Foi criado um `index.ts` separado e puro para Client Components, evitando importar Prisma no bundle do navegador.
- `useTransactions()` remove `type=all` e `status=all` da query antes de chamar a API, porque a API da Etapa 04-A valida enums e rejeita esses valores literais.
- A API da Etapa 04-A retorna `summary`; o hook aceita tanto `summary` quanto `totals` para compatibilidade.
- O formulario trata selects vazios como `null` para compatibilidade com o schema Zod e com as validacoes da API.
- A UI usa os componentes locais existentes (`Button`, `Input`, `Select`, `Table`, `Modal`) e icones de `lucide-react`.
- A troca de tipo de lancamento fica bloqueada na edicao, alinhada a regra da Etapa 04-A de nao alterar `type` depois da criacao.
- A exportacao CSV da tela `/transactions` e local, baseada na lista filtrada atualmente carregada.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 7 arquivos e 65 testes.
- `npm run lint`: passou, sem warnings ou erros.
- `npm run build`: passou.

Verificacao local adicional:

- `npm run dev -- -H 127.0.0.1 -p 3000` iniciado com sucesso.
- URL local: `http://127.0.0.1:3000`.
- `curl -I http://127.0.0.1:3000/transactions`: respondeu `307 Temporary Redirect` para `/login?redirect=%2Ftransactions`, comportamento esperado sem sessao autenticada.

Ainda nao executado:

- Teste manual autenticado de criar/editar lancamento, parcelamento, recorrencia e baixa, porque depende de sessao Supabase real e dados cadastrados.
- Teste manual autenticado de `/payables` e `/receivables`.
- SQL/RLS/bucket pendentes da Etapa 04-A continuam necessarios para anexos e seguranca em ambiente Supabase.

Proxima etapa recomendada:

1. Aplicar pendencias Supabase da Etapa 04-A, caso ainda nao tenham sido aplicadas.
2. Entrar no app local em `http://127.0.0.1:3000/login`.
3. Testar `/transactions` com empresa, categorias, centros de custo e contas reais.
4. Criar uma receita pendente, uma despesa pendente, uma despesa parcelada e uma recorrencia mensal.
5. Testar baixa rapida em `/transactions`, `/payables` e `/receivables`.
6. Somente apos validacao manual iniciar Etapa 04-C - detalhe do lancamento e parcelas.

---

## Hotfix 2026-06-24 - Auth Supabase sem env local

Foi corrigido um crash no cadastro/login quando o subprojeto `cashflowai/` roda sem:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Contexto:

- Existe `.env.local` na raiz do repo, mas nao existe `cashflowai/.env.local`.
- Como o servidor Next e iniciado dentro de `cashflowai/`, ele nao carrega automaticamente o `.env.local` da raiz.
- Antes, `lib/supabase/client.ts` chamava `createBrowserClient()` com envs undefined e o Next exibia overlay de runtime error ao tentar criar usuario.

Mudancas feitas:

- `lib/supabase/client.ts` agora exporta:
  - `SUPABASE_BROWSER_CONFIG_ERROR`
  - `isSupabaseBrowserConfigured()`
  - `createClient()` com validacao explicita antes de criar o client.
- Telas protegidas contra crash:
  - `/register`
  - `/login`
  - `/forgot-password`
  - `/reset-password`
  - `/invite/[token]`
- Em vez de overlay, as telas exibem mensagem informando para criar `cashflowai/.env.local` com as variaveis publicas do Supabase.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run lint
npm run build
npm run test
```

Resultado:

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build`: passou.
- `npm run test`: passou, 7 arquivos e 65 testes.
- `curl -I http://127.0.0.1:3000/register`: respondeu `200 OK`.

Pendente para o cadastro funcionar de ponta a ponta:

1. Criar `cashflowai/.env.local`.
2. Preencher pelo menos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Reiniciar o dev server apos criar/alterar env vars.

---

## Atualizacao 2026-06-24 - CashFlowAI Etapa 04-C

Foi implementada a Etapa 04-C no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Entregas principais:

- Tela de detalhe de lancamento em `/transactions/[id]`, com historico visual, datas, classificacao, conta, contato, valores, status, estorno, edicao, cancelamento, baixa e anexos.
- Link da descricao na listagem `/transactions` para abrir o detalhe do lancamento.
- Painel de parcelas:
  - `components/transactions/installments-panel.tsx`
  - baixa individual de parcela;
  - resumo de parcelas pagas/pendentes;
  - atualizacao do lancamento pai quando todas as parcelas sao pagas/recebidas.
- Painel de anexos:
  - `components/shared/attachment-panel.tsx`
  - upload, listagem, download por signed URL e exclusao logica.
- Storage privado para anexos:
  - `lib/supabase/storage.ts`
  - bucket-alvo `cashflowai-attachments`;
  - path `{companyId}/{entityType}/{entityId}/{timestamp}-{filename}`;
  - checksum SHA-256, limite de 10MB e URLs assinadas.
- APIs de anexos ajustadas:
  - `app/api/attachments/route.ts`
  - `app/api/attachments/[id]/route.ts`
- Testes adicionados:
  - `lib/supabase/storage.test.ts`
  - `components/transactions/installments-panel.test.ts`

Adaptacoes importantes ao prompt:

- A Etapa 04-A mencionava bucket `attachments`; a Etapa 04-C passa a usar `cashflowai-attachments`. Para evitar ambiguidade, considerar `cashflowai-attachments` como o bucket vigente para anexos.
- As APIs de anexos validam escopo por `companyId` e existencia da entidade antes de aceitar upload/listagem.
- O upload usa Supabase Storage pelo client server-side autenticado e depende das policies de Storage no Supabase real.
- A exclusao de anexo marca `active=false` no banco e tenta remover o objeto do bucket.
- O teste do painel de parcelas valida a funcao pura `generateInstallmentPreviews()`, evitando dependencias novas de renderizacao de React.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 9 arquivos e 73 testes.
- `npm run lint`: passou, sem warnings ou erros.
- `npm run build`: passou. O Next exibiu apenas o warning conhecido de Supabase usando API Node no Edge Runtime, sem quebrar o build.

Verificacao local adicional:

- `npm run dev -- -H 127.0.0.1 -p 3001` iniciado com sucesso.
- URL local: `http://127.0.0.1:3001`.
- `curl -I http://127.0.0.1:3001/transactions`: respondeu `307 Temporary Redirect` para `/login?redirect=%2Ftransactions`, comportamento esperado sem sessao autenticada.

Ainda nao executado:

- Teste manual autenticado de `/transactions/[id]`, baixa de parcela e anexos, porque depende de sessao Supabase real, banco acessivel e dados cadastrados.
- Upload real para Supabase Storage, porque depende do bucket/policies aplicados no projeto Supabase.

SQL/manual pendente no Supabase para Etapa 04-C:

- Criar bucket privado `cashflowai-attachments`.
- Criar policies de `storage.objects` para permitir leitura/escrita autenticada apenas em paths do tenant autorizado:
  - prefixo esperado: `{companyId}/{entityType}/{entityId}/...`
  - operacoes necessarias: upload, signed URL/download e delete.
- Garantir RLS/permissions da tabela `attachments` alinhadas ao mesmo escopo multi-tenant.

Proxima etapa recomendada:

1. Aplicar bucket e policies de Storage da Etapa 04-C no Supabase CashFlowAI.
2. Entrar no app local em `http://127.0.0.1:3001/login`.
3. Abrir um lancamento em `/transactions/[id]`.
4. Testar edicao, baixa, cancelamento, estorno, upload/download/exclusao de anexo.
5. Criar um lancamento parcelado e baixar todas as parcelas para validar a atualizacao do status do lancamento pai.

---

## Atualizacao 2026-06-24 - CashFlowAI Etapa 05

Foi implementada a Etapa 05 no subprojeto isolado:

```text
cashflowai/
```

O projeto legado da raiz nao foi alterado. A unica alteracao fora de `cashflowai/` foi esta atualizacao de handoff.

Dependencia adicionada:

```bash
npm install xlsx
```

Observacao: o `npm install` reportou vulnerabilidades via `npm audit` no grafo de dependencias. Nao foi executado `npm audit fix --force`, porque pode introduzir upgrades com breaking changes.

Entregas principais:

- Parsers:
  - `lib/parsers/types.ts`
  - `lib/parsers/ofx.ts`
  - `lib/parsers/csv-xlsx.ts`
- Testes de parser:
  - `lib/parsers/ofx.test.ts`
  - `lib/parsers/csv-xlsx.test.ts`
- APIs de extratos:
  - `GET /api/bank/statements`
  - `GET /api/bank/statements/[id]`
  - `POST /api/bank/statements/upload`
  - `POST /api/bank/statements/[id]/process`
- APIs de mapeamento:
  - `GET/POST /api/import-mappings`
  - `GET/PATCH/DELETE /api/import-mappings/[id]`
- Telas:
  - `/bank/statements/import`: fluxo guiado de upload, mapeamento CSV/XLSX, cambio, confirmacao e resultado.
  - `/bank/statements`: historico de importacoes.
- Sidebar:
  - adicionada entrada `Extratos` em Banco.
- Seed:
  - `prisma/seed.ts` agora tenta criar o mapping global `Mercury USD - Padrao CSV` quando ja existe ao menos um vinculo usuario/empresa valido.

Comportamento implementado:

- OFX:
  - ignora lancamentos de saldo (`SALDO ANTERIOR`, `SALDO TOTAL DISPONIVEL`, etc.);
  - calcula SHA-256 do arquivo;
  - parseia valores com ponto ou virgula decimal;
  - detecta bancos por `BANKID`;
  - extrai `operationDate` do memo em casos Bradesco D+1;
  - reconstrui `balanceAfter` quando ha `LEDGERBAL/BALAMT`.
- CSV/XLSX:
  - usa `ImportMapping`;
  - suporta coluna unica com sinal, negativo como debito e colunas separadas;
  - suporta separador decimal e separador de milhar;
  - detecta colunas para montar o formulario;
  - tolera CSV brasileiro simples com virgula decimal nao-quoted no ultimo campo.
- Upload:
  - aceita `.ofx`, `.csv`, `.xlsx`, `.xls`;
  - limita arquivos a 50 MB;
  - deduplica por `bankAccountId + fileHash`;
  - grava no bucket `cashflowai-statements`;
  - cria `BankStatement` com status `pending` ou `storage_error`.
- Processamento:
  - baixa arquivo do Storage;
  - cria `BankMove` com normalizacao de descricao;
  - aplica taxa de cambio quando a conta difere da moeda base da empresa;
  - faz deduplicacao hard por `bankRef`;
  - faz deduplicacao soft por data +/-3 dias, valor e descricao;
  - salva mapping inline quando solicitado.

Adaptacoes importantes ao prompt:

- `BankStatement` tem campo scalar `bankProviderId`, mas nao possui relacao Prisma direta `bankProvider`; as APIs retornam o provider via `bankAccount.bankProvider`.
- O seed do Mercury nao usa `company.id` como `createdById`; ele so cria o mapping se encontrar um `userCompanyRole`, usando `companyId` e `userId` validos.
- A tela evita emojis/setas textuais e usa icones `lucide-react`, alinhada ao padrao visual do app.
- A confirmacao de processamento fica bloqueada se o upload entrou em `storage_error`, porque o processamento depende de recuperar o arquivo do bucket.

Verificacoes executadas em `cashflowai/`:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Resultado:

- `npm run typecheck`: passou.
- `npm run test`: passou, 11 arquivos e 94 testes.
- `npm run lint`: passou, sem warnings ou erros.
- `npm run build`: passou.

Verificacao local adicional:

- O dev server anterior segue rodando em `http://127.0.0.1:3001`.
- A validacao HTTP com `curl -I http://127.0.0.1:3001/bank/statements/import` nao foi executada porque a permissao fora do sandbox foi recusada nesta rodada.

Ainda nao executado:

- Teste manual autenticado de upload/processamento, porque depende de sessao Supabase real, bucket `cashflowai-statements`, RLS/policies e dados de conta bancaria cadastrados.
- Aplicacao do SQL de RLS da Etapa 05 no Supabase.
- Criacao do bucket privado `cashflowai-statements` no Supabase.

SQL/manual pendente no Supabase para Etapa 05:

- Habilitar RLS e policies em:
  - `bank_statements`
  - `bank_moves`
  - `import_mappings`
- Criar bucket privado:
  - `cashflowai-statements`
- Criar policies de `storage.objects` para `cashflowai-statements`, com acesso por prefixo:
  - `{companyId}/statements/{bankAccountId}/...`

Proxima etapa recomendada:

1. Aplicar SQL/RLS da Etapa 05 no Supabase CashFlowAI.
2. Criar bucket privado `cashflowai-statements` com MIME types do prompt.
3. Rodar `cd cashflowai && npm run dev`.
4. Entrar em `http://127.0.0.1:3001/login`.
5. Testar `/bank/statements/import` com OFX Bradesco, OFX Itau e CSV Mercury.
6. Reimportar o mesmo arquivo para confirmar erro 409 de duplicidade.
7. Validar em `/bank/statements` os totais de movimentos, duplicatas e status.
