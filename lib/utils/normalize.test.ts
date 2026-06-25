import { describe, expect, it } from 'vitest';
import { normalizeDescription } from './normalize';

describe('normalizeDescription', () => {
  it('remove palavras de ruido', () => {
    const { normalized } = normalizeDescription('PIX ENVIADO - FORNECEDOR LTDA');
    expect(normalized).not.toContain('PIX');
    expect(normalized).toContain('FORNECEDOR');
  });

  it('extrai CNPJ', () => {
    const { merchantDocument } = normalizeDescription('PGTO 12.345.678/0001-90 EMPRESA');
    expect(merchantDocument).toBe('12.345.678/0001-90');
  });

  it('remove datas embutidas', () => {
    const { normalized } = normalizeDescription('COMPRA 15/03 - MERCADO BOM');
    expect(normalized).not.toMatch(/\d{2}\/\d{2}/);
    expect(normalized).toContain('MERCADO');
  });

  it('retorna null para texto vazio apos limpeza', () => {
    const { merchantName } = normalizeDescription('PIX TED DOC 01/01');
    expect(merchantName).toBeNull();
  });
});
