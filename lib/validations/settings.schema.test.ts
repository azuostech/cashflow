import { describe, expect, it } from 'vitest';
import { createCategorySchema, createContactSchema, createCostCenterSchema, updateCompanySchema } from './settings.schema';

describe('updateCompanySchema', () => {
  it('aceita atualizacao parcial', () => {
    expect(updateCompanySchema.safeParse({ name: 'Nova Empresa' }).success).toBe(true);
  });

  it('aceita objeto vazio', () => {
    expect(updateCompanySchema.safeParse({}).success).toBe(true);
  });

  it('rejeita nome com 1 char', () => {
    expect(updateCompanySchema.safeParse({ name: 'A' }).success).toBe(false);
  });

  it('rejeita size invalido', () => {
    expect(updateCompanySchema.safeParse({ size: 'gigante' }).success).toBe(false);
  });
});

describe('createCostCenterSchema', () => {
  it('aceita centro de custo simples', () => {
    expect(createCostCenterSchema.safeParse({ name: 'Comercial' }).success).toBe(true);
  });

  it('aceita centro de custo com codigo e pai', () => {
    expect(
      createCostCenterSchema.safeParse({
        name: 'Sub-Comercial',
        code: 'CC002',
        parentId: '11111111-1111-1111-1111-111111111111'
      }).success
    ).toBe(true);
  });

  it('rejeita nome vazio', () => {
    expect(createCostCenterSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejeita parentId invalido', () => {
    expect(createCostCenterSchema.safeParse({ name: 'CC', parentId: 'nao-uuid' }).success).toBe(false);
  });
});

describe('createCategorySchema', () => {
  const valid = {
    name: 'Receita de Servicos',
    type: 'revenue',
    dreNodeId: '11111111-1111-1111-1111-111111111111',
    cashflowGroup: 'operating_inflow'
  };

  it('aceita categoria valida', () => {
    expect(createCategorySchema.safeParse(valid).success).toBe(true);
  });

  it('rejeita tipo invalido', () => {
    expect(createCategorySchema.safeParse({ ...valid, type: 'ganho' }).success).toBe(false);
  });

  it('rejeita cashflowGroup invalido', () => {
    expect(createCategorySchema.safeParse({ ...valid, cashflowGroup: 'outro' }).success).toBe(false);
  });

  it('rejeita dreNodeId sem formato UUID', () => {
    expect(createCategorySchema.safeParse({ ...valid, dreNodeId: 'abc' }).success).toBe(false);
  });
});

describe('createContactSchema', () => {
  it('aceita contato minimo', () => {
    expect(createContactSchema.safeParse({ name: 'Empresa XYZ', type: 'supplier' }).success).toBe(true);
  });

  it('aceita contato completo', () => {
    expect(
      createContactSchema.safeParse({
        name: 'Empresa XYZ',
        type: 'customer',
        document: '11.222.333/0001-81',
        email: 'contato@empresa.com',
        phone: '(11) 99999-9999'
      }).success
    ).toBe(true);
  });

  it('rejeita e-mail invalido', () => {
    expect(createContactSchema.safeParse({ name: 'XYZ', type: 'other', email: 'nao-email' }).success).toBe(false);
  });

  it('rejeita tipo invalido', () => {
    expect(createContactSchema.safeParse({ name: 'XYZ', type: 'desconhecido' }).success).toBe(false);
  });
});
