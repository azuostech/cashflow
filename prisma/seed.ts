import { DRENodeType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCurrencies() {
  await prisma.currency.upsert({
    where: { code: 'BRL' },
    update: {},
    create: { code: 'BRL', name: 'Real Brasileiro', symbol: 'R$', decimalPlaces: 2, active: true }
  });
  await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'Dolar Americano', symbol: '$', decimalPlaces: 2, active: true }
  });
  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: 'EUR', decimalPlaces: 2, active: true }
  });
}

async function seedBankProviders() {
  const providers = [
    { name: 'Itau', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    { name: 'Bradesco', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    { name: 'Banco do Brasil', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    { name: 'Nubank', country: 'BR', formats: ['ofx', 'csv'], defaultCurrency: 'BRL' },
    { name: 'Santander', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    { name: 'Caixa Economica', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    { name: 'BTG Pactual', country: 'BR', formats: ['ofx', 'csv'], defaultCurrency: 'BRL' },
    { name: 'Inter', country: 'BR', formats: ['ofx', 'csv'], defaultCurrency: 'BRL' },
    { name: 'Sicredi', country: 'BR', formats: ['ofx'], defaultCurrency: 'BRL' },
    {
      name: 'Mercury',
      country: 'US',
      formats: ['csv', 'xlsx'],
      defaultCurrency: 'USD',
      notes: 'Nao suporta OFX. Usar CSV/XLSX com ImportMapping Mercury.'
    },
    { name: 'Wise', country: 'GB', formats: ['csv', 'xlsx'], defaultCurrency: 'USD' },
    { name: 'Payoneer', country: 'US', formats: ['csv', 'xlsx'], defaultCurrency: 'USD' }
  ];

  for (const provider of providers) {
    const existing = await prisma.bankProvider.findFirst({
      where: { name: provider.name, country: provider.country, isGlobal: true }
    });

    const data = {
      name: provider.name,
      country: provider.country,
      supportedFormats: provider.formats,
      defaultCurrency: provider.defaultCurrency,
      notes: provider.notes ?? null,
      isGlobal: true,
      active: true
    };

    if (existing) {
      await prisma.bankProvider.update({ where: { id: existing.id }, data });
    } else {
      await prisma.bankProvider.create({ data });
    }
  }
}

async function seedGlobalDRENodes() {
  const dreTemplate = [
    { code: '1.0', name: 'Receita Bruta', type: DRENodeType.revenue, sign: 1, sortOrder: 10, isSubtotal: false, parentCode: null },
    { code: '1.1', name: 'Receita de Produtos', type: DRENodeType.revenue, sign: 1, sortOrder: 11, isSubtotal: false, parentCode: '1.0' },
    { code: '1.2', name: 'Receita de Servicos', type: DRENodeType.revenue, sign: 1, sortOrder: 12, isSubtotal: false, parentCode: '1.0' },
    { code: '1.3', name: 'Outras Receitas Operacionais', type: DRENodeType.revenue, sign: 1, sortOrder: 13, isSubtotal: false, parentCode: '1.0' },
    { code: '2.0', name: 'Deducoes da Receita', type: DRENodeType.deduction, sign: -1, sortOrder: 20, isSubtotal: false, parentCode: null },
    { code: '2.1', name: 'Impostos sobre Receita', type: DRENodeType.deduction, sign: -1, sortOrder: 21, isSubtotal: false, parentCode: '2.0' },
    { code: '2.2', name: 'Devolucoes e Cancelamentos', type: DRENodeType.deduction, sign: -1, sortOrder: 22, isSubtotal: false, parentCode: '2.0' },
    { code: 'S1', name: 'Receita Liquida', type: DRENodeType.revenue, sign: 1, sortOrder: 30, isSubtotal: true, parentCode: null },
    { code: '3.0', name: 'Custos Variaveis', type: DRENodeType.variable_cost, sign: -1, sortOrder: 40, isSubtotal: false, parentCode: null },
    { code: '3.1', name: 'Custo das Mercadorias Vendidas', type: DRENodeType.variable_cost, sign: -1, sortOrder: 41, isSubtotal: false, parentCode: '3.0' },
    { code: '3.2', name: 'Custo dos Servicos Prestados', type: DRENodeType.variable_cost, sign: -1, sortOrder: 42, isSubtotal: false, parentCode: '3.0' },
    { code: '3.3', name: 'Comissoes de Vendas', type: DRENodeType.variable_cost, sign: -1, sortOrder: 43, isSubtotal: false, parentCode: '3.0' },
    { code: 'S2', name: 'Margem de Contribuicao', type: DRENodeType.variable_cost, sign: 1, sortOrder: 50, isSubtotal: true, parentCode: null },
    { code: '4.0', name: 'Despesas Operacionais Fixas', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 60, isSubtotal: false, parentCode: null },
    { code: '4.1', name: 'Pessoal e Encargos', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 61, isSubtotal: false, parentCode: '4.0' },
    { code: '4.2', name: 'Aluguel e Ocupacao', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 62, isSubtotal: false, parentCode: '4.0' },
    { code: '4.3', name: 'Marketing e Publicidade', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 63, isSubtotal: false, parentCode: '4.0' },
    { code: '4.4', name: 'Tecnologia e Software', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 64, isSubtotal: false, parentCode: '4.0' },
    { code: '4.5', name: 'Despesas Administrativas', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 65, isSubtotal: false, parentCode: '4.0' },
    { code: '4.6', name: 'Outras Despesas Operacionais', type: DRENodeType.fixed_cost, sign: -1, sortOrder: 66, isSubtotal: false, parentCode: '4.0' },
    { code: 'S3', name: 'Resultado Operacional', type: DRENodeType.fixed_cost, sign: 1, sortOrder: 70, isSubtotal: true, parentCode: null },
    { code: '5.0', name: 'Resultado Financeiro', type: DRENodeType.financial, sign: 1, sortOrder: 80, isSubtotal: false, parentCode: null },
    { code: '5.1', name: 'Receitas Financeiras', type: DRENodeType.financial, sign: 1, sortOrder: 81, isSubtotal: false, parentCode: '5.0' },
    { code: '5.2', name: 'Despesas Financeiras', type: DRENodeType.financial, sign: -1, sortOrder: 82, isSubtotal: false, parentCode: '5.0' },
    { code: '5.3', name: 'IOF e Tarifas Bancarias', type: DRENodeType.financial, sign: -1, sortOrder: 83, isSubtotal: false, parentCode: '5.0' },
    { code: 'S4', name: 'Resultado Antes do IR', type: DRENodeType.financial, sign: 1, sortOrder: 90, isSubtotal: true, parentCode: null },
    { code: '6.0', name: 'Impostos sobre Resultado', type: DRENodeType.tax, sign: -1, sortOrder: 100, isSubtotal: false, parentCode: null },
    { code: '6.1', name: 'IRPJ / CSLL', type: DRENodeType.tax, sign: -1, sortOrder: 101, isSubtotal: false, parentCode: '6.0' },
    { code: '6.2', name: 'Simples Nacional', type: DRENodeType.tax, sign: -1, sortOrder: 102, isSubtotal: false, parentCode: '6.0' },
    { code: 'S5', name: 'Lucro Liquido', type: DRENodeType.tax, sign: 1, sortOrder: 110, isSubtotal: true, parentCode: null }
  ];

  const createdNodes = new Map<string, string>();

  for (const node of dreTemplate.filter((item) => item.parentCode === null)) {
    const existing = await prisma.dRENode.findFirst({ where: { code: node.code, isGlobal: true } });
    const data = {
      name: node.name,
      code: node.code,
      type: node.type,
      sign: node.sign,
      sortOrder: node.sortOrder,
      isSubtotal: node.isSubtotal,
      isGlobal: true,
      active: true
    };

    const record = existing
      ? await prisma.dRENode.update({ where: { id: existing.id }, data })
      : await prisma.dRENode.create({ data });

    createdNodes.set(node.code, record.id);
  }

  for (const node of dreTemplate.filter((item) => item.parentCode !== null)) {
    const parentId = createdNodes.get(node.parentCode ?? '');
    const existing = await prisma.dRENode.findFirst({ where: { code: node.code, isGlobal: true } });
    const data = {
      name: node.name,
      code: node.code,
      type: node.type,
      sign: node.sign,
      sortOrder: node.sortOrder,
      isSubtotal: node.isSubtotal,
      isGlobal: true,
      active: true,
      parentId: parentId ?? null
    };

    const record = existing
      ? await prisma.dRENode.update({ where: { id: existing.id }, data })
      : await prisma.dRENode.create({ data });

    createdNodes.set(node.code, record.id);
  }

  return createdNodes.size;
}

async function seedMercuryImportMapping() {
  const mercuryProvider = await prisma.bankProvider.findFirst({
    where: { name: 'Mercury', isGlobal: true }
  });

  if (!mercuryProvider) return false;

  const existing = await prisma.importMapping.findFirst({
    where: { isGlobal: true, name: 'Mercury USD - Padrao CSV' }
  });

  if (existing) return false;

  const bootstrapRole = await prisma.userCompanyRole.findFirst({
    select: { companyId: true, userId: true }
  });

  if (!bootstrapRole) {
    console.log('Mercury ImportMapping: nenhum usuario/empresa encontrado - seed pulado.');
    return false;
  }

  await prisma.importMapping.create({
    data: {
      companyId: bootstrapRole.companyId,
      bankProviderId: mercuryProvider.id,
      name: 'Mercury USD - Padrao CSV',
      fileFormat: 'csv',
      dateColumn: 'Date',
      descriptionColumn: 'Description',
      amountColumn: null,
      debitColumn: 'Amount Out',
      creditColumn: 'Amount In',
      referenceColumn: 'Transaction ID',
      dateFormat: 'MM/dd/yyyy',
      decimalSeparator: '.',
      thousandSeparator: null,
      headerRow: 1,
      skipRowsStart: 0,
      skipRowsEnd: 0,
      amountSignConvention: 'separate_columns',
      defaultCurrency: 'USD',
      isGlobal: true,
      active: true,
      createdById: bootstrapRole.userId
    }
  });

  return true;
}

async function main() {
  console.log('Seeding database...');
  await seedCurrencies();
  await seedBankProviders();
  const dreNodeCount = await seedGlobalDRENodes();
  const mercuryMappingCreated = await seedMercuryImportMapping();
  console.log('Seed concluido.');
  console.log(`DRENodes globais: ${dreNodeCount}`);
  console.log(`Mercury ImportMapping criado: ${mercuryMappingCreated ? 'sim' : 'nao'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
