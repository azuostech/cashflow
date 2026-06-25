import { describe, expect, it } from 'vitest';
import { parseCSVContent } from './csv-xlsx';

const MERCURY_MAPPING = {
  dateColumn: 'Date',
  descriptionColumn: 'Description',
  debitColumn: 'Amount Out',
  creditColumn: 'Amount In',
  referenceColumn: 'Transaction ID',
  dateFormat: 'MM/dd/yyyy',
  decimalSeparator: '.',
  thousandSeparator: null,
  headerRow: 1,
  skipRowsStart: 0,
  skipRowsEnd: 0,
  amountSignConvention: 'separate_columns' as const,
  defaultCurrency: 'USD'
};

const MERCURY_CSV = `Date,Description,Amount Out,Amount In,Transaction ID
03/15/2025,AWS Invoice,2450.00,,TXN001
03/20/2025,Stripe Payout,,8000.00,TXN002
03/25/2025,Google Cloud,125.50,,TXN003`;

describe('parseCSVContent - Mercury USD', () => {
  it('parseia colunas separadas', () => {
    expect(parseCSVContent(MERCURY_CSV, MERCURY_MAPPING)).toHaveLength(3);
  });

  it('identifica debitos', () => {
    const aws = parseCSVContent(MERCURY_CSV, MERCURY_MAPPING).find((move) => move.description.includes('AWS'));

    expect(aws?.type).toBe('debit');
    expect(aws?.amount).toBeCloseTo(2450, 2);
  });

  it('identifica creditos', () => {
    const stripe = parseCSVContent(MERCURY_CSV, MERCURY_MAPPING).find((move) => move.description.includes('Stripe'));

    expect(stripe?.type).toBe('credit');
    expect(stripe?.amount).toBeCloseTo(8000, 2);
  });

  it('parseia data MM/DD/YYYY', () => {
    const moves = parseCSVContent(MERCURY_CSV, MERCURY_MAPPING);

    expect(moves[0].date.toISOString().slice(0, 10)).toBe('2025-03-15');
  });

  it('preserva referencia bancaria quando configurada', () => {
    const moves = parseCSVContent(MERCURY_CSV, MERCURY_MAPPING);

    expect(moves[0].bankRef).toBe('TXN001');
  });
});

const BR_MAPPING = {
  dateColumn: 'Data',
  descriptionColumn: 'Descricao',
  amountColumn: 'Valor',
  dateFormat: 'dd/MM/yyyy',
  decimalSeparator: ',',
  thousandSeparator: '.',
  headerRow: 1,
  skipRowsStart: 0,
  skipRowsEnd: 0,
  amountSignConvention: 'debit_negative' as const,
  defaultCurrency: 'BRL'
};

const BR_CSV = `Data,Descricao,Valor
15/03/2025,Fornecedor XYZ,-1.234,56
20/03/2025,Cliente ABC,5.000,00`;

describe('parseCSVContent - BR com virgula decimal', () => {
  it('parseia valor negativo como debito', () => {
    const debit = parseCSVContent(BR_CSV, BR_MAPPING).find((move) => move.description.includes('Fornecedor'));

    expect(debit?.type).toBe('debit');
    expect(debit?.amount).toBeCloseTo(1234.56, 2);
  });

  it('parseia valor positivo como credito', () => {
    const credit = parseCSVContent(BR_CSV, BR_MAPPING).find((move) => move.description.includes('Cliente'));

    expect(credit?.type).toBe('credit');
    expect(credit?.amount).toBeCloseTo(5000, 2);
  });

  it('parseia data DD/MM/YYYY', () => {
    const moves = parseCSVContent(BR_CSV, BR_MAPPING);

    expect(moves[0].date.toISOString().slice(0, 10)).toBe('2025-03-15');
  });
});
