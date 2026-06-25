import { describe, expect, it } from 'vitest';
import { parseOFX } from './ofx';

const BRADESCO_OFX = Buffer.from(`
OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>237</BANKID><ACCTID>12345-6</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20250608000000</DTPOSTED>
<TRNAMT>-3494,34</TRNAMT>
<FITID>BRAD20250608001</FITID>
<MEMO>PIX ENVIADO 07/06 FORNECEDOR LTDA</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20250605000000</DTPOSTED>
<TRNAMT>1600,00</TRNAMT>
<FITID>BRAD20250605001</FITID>
<MEMO>PIX RECEBIDO CLIENTE SA</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20250605000000</DTPOSTED>
<TRNAMT>-0,01</TRNAMT>
<FITID>BRAD20250605002</FITID>
<MEMO>SALDO ANTERIOR</MEMO>
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>5000,00</BALAMT></LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`);

const ITAU_OFX = Buffer.from(`
OFXHEADER:100
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM><BANKID>341</BANKID><ACCTID>99999-0</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20250401000000</DTPOSTED>
<TRNAMT>-1200.00</TRNAMT>
<FITID>ITAU20250401001</FITID>
<MEMO>ALUGUEL ESCRITORIO</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20250401000000</DTPOSTED>
<TRNAMT>100.00</TRNAMT>
<FITID>ITAU20250401002</FITID>
<MEMO>SALDO TOTAL DISPONIVEL DIA</MEMO>
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`);

describe('parseOFX - Bradesco', () => {
  it('ignora lancamentos de saldo', () => {
    const result = parseOFX(BRADESCO_OFX);

    expect(result.moves.find((move) => move.description.includes('SALDO ANTERIOR'))).toBeUndefined();
    expect(result.moves).toHaveLength(2);
  });

  it('parseia valores com virgula decimal', () => {
    const debit = parseOFX(BRADESCO_OFX).moves.find((move) => move.type === 'debit');

    expect(debit?.amount).toBeCloseTo(3494.34, 2);
  });

  it('detecta banco Bradesco por codigo 237', () => {
    const result = parseOFX(BRADESCO_OFX);

    expect(result.bankId).toBe('237');
    expect(result.bankName).toContain('Bradesco');
  });

  it('extrai operationDate do memo Bradesco', () => {
    const debit = parseOFX(BRADESCO_OFX).moves.find((move) => move.type === 'debit');

    expect(debit?.operationDate?.toISOString().slice(0, 10)).toBe('2025-06-07');
    expect(debit?.date.toISOString().slice(0, 10)).toBe('2025-06-07');
  });

  it('retorna credit para TRNAMT positivo', () => {
    const credit = parseOFX(BRADESCO_OFX).moves.find((move) => move.type === 'credit');

    expect(credit?.amount).toBeCloseTo(1600, 2);
  });

  it('gera fileHash SHA-256', () => {
    const result = parseOFX(BRADESCO_OFX);

    expect(result.fileHash).toHaveLength(64);
    expect(result.fileHash).toMatch(/^[a-f0-9]+$/);
  });

  it('gera warnings quando banco diverge do esperado', () => {
    const result = parseOFX(BRADESCO_OFX, { expectedBankId: '341' });

    expect(result.warnings[0]).toContain('237');
  });

  it('nao gera warning quando banco bate com esperado', () => {
    const result = parseOFX(BRADESCO_OFX, { expectedBankId: '237' });

    expect(result.warnings).toHaveLength(0);
  });
});

describe('parseOFX - Itau', () => {
  it('ignora saldo total disponivel', () => {
    const result = parseOFX(ITAU_OFX);

    expect(result.moves.find((move) => move.description.includes('SALDO TOTAL'))).toBeUndefined();
    expect(result.moves).toHaveLength(1);
  });

  it('parseia valores com ponto decimal', () => {
    const debit = parseOFX(ITAU_OFX).moves.find((move) => move.type === 'debit');

    expect(debit?.amount).toBeCloseTo(1200, 2);
  });

  it('detecta banco Itau por codigo 341', () => {
    const result = parseOFX(ITAU_OFX);

    expect(result.bankId).toBe('341');
    expect(result.bankName).toContain('Itau');
  });

  it('usa postedDate quando nao ha data operacional', () => {
    const debit = parseOFX(ITAU_OFX).moves.find((move) => move.type === 'debit');

    expect(debit?.operationDate).toBeNull();
    expect(debit?.date.toISOString().slice(0, 10)).toBe('2025-04-01');
  });
});

describe('parseOFX - normalizacao', () => {
  it('normaliza descricao e remove ruido', () => {
    const credit = parseOFX(BRADESCO_OFX).moves.find((move) => move.type === 'credit');

    expect(credit?.descriptionNormalized).not.toContain('PIX');
    expect(credit?.descriptionNormalized).toContain('CLIENTE');
  });
});
