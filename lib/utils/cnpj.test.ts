import { describe, expect, it } from 'vitest';
import { formatCNPJ, validateCNPJ } from './cnpj';

describe('validateCNPJ', () => {
  it('aceita CNPJ valido', () => {
    expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
    expect(validateCNPJ('11222333000181')).toBe(true);
  });

  it('rejeita CNPJ com digitos todos iguais', () => {
    expect(validateCNPJ('00000000000000')).toBe(false);
    expect(validateCNPJ('11111111111111')).toBe(false);
  });

  it('rejeita CNPJ com digito verificador errado', () => {
    expect(validateCNPJ('11.222.333/0001-80')).toBe(false);
  });

  it('rejeita CNPJ com menos de 14 digitos', () => {
    expect(validateCNPJ('1122233300018')).toBe(false);
  });
});

describe('formatCNPJ', () => {
  it('formata CNPJ sem mascara', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
});
