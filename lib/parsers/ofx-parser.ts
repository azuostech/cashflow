export interface ParsedTransaction {
  date: string;
  description: string;
  documentNumber: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
}

export interface ParsedStatement {
  periodStart: string;
  periodEnd: string;
  initialBalance: number;
  finalBalance: number;
  bank: ParsedBankInfo;
  warnings: string[];
  transactions: ParsedTransaction[];
}

interface RawTransaction {
  id: string;
  postedKey: number;
  date: string;
  description: string;
  documentNumber: string;
  type: 'credit' | 'debit';
  amount: number;
  signedAmount: number;
}

export interface ParsedBankInfo {
  bankId: string | null;
  bankName: string | null;
  bankKey: string | null;
  accountId: string | null;
  accountType: string | null;
}

interface ParseOFXOptions {
  expectedBankName?: string | null;
  expectedAccountNumber?: string | null;
}

const BANKS_BY_CODE: Record<string, { key: string; name: string }> = {
  '1': { key: 'banco-do-brasil', name: 'Banco do Brasil' },
  '33': { key: 'santander', name: 'Santander' },
  '77': { key: 'inter', name: 'Inter' },
  '104': { key: 'caixa', name: 'Caixa' },
  '237': { key: 'bradesco', name: 'Bradesco' },
  '260': { key: 'nubank', name: 'Nubank' },
  '341': { key: 'itau', name: 'Itau' },
  '748': { key: 'sicredi', name: 'Sicredi' }
};

function extractTagValue(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = content.match(regex);
  return match?.[1]?.trim() || null;
}

function countReplacementCharacters(content: string): number {
  return content.match(/\uFFFD/g)?.length ?? 0;
}

function decodeOfxBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  const latin1 = buffer.toString('latin1');

  return countReplacementCharacters(utf8) <= countReplacementCharacters(latin1) ? utf8 : latin1;
}

function parseOfxAmount(value: string | null): number | null {
  if (!value) return null;

  const trimmed = value.trim();
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  let normalized = trimmed;

  if (hasComma && hasDot) {
    normalized =
      trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
        ? trimmed.replace(/\./g, '').replace(',', '.')
        : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseOfxDate(value: string | null): { date: string; key: number } | null {
  if (!value) return null;

  const digits = value.match(/\d{8,14}/)?.[0];
  if (!digits || digits.length < 8) return null;

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hh = digits.slice(8, 10) || '00';
  const mm = digits.slice(10, 12) || '00';
  const ss = digits.slice(12, 14) || '00';

  const key = Number(`${year}${month}${day}${hh}${mm}${ss}`);
  return {
    date: `${year}-${month}-${day}`,
    key
  };
}

function inferType(typeTag: string | null, signedAmount: number): 'credit' | 'debit' {
  if (signedAmount > 0) return 'credit';
  if (signedAmount < 0) return 'debit';

  const normalized = (typeTag || '').toUpperCase();
  if (['CREDIT', 'DEP', 'INT', 'DIV'].includes(normalized)) return 'credit';
  return 'debit';
}

function normalizeDescription(memo: string | null, typeTag: string | null): string {
  if (memo && memo.trim()) {
    return memo.replace(/\s+/g, ' ').trim();
  }

  const fallback = (typeTag || 'LANCAMENTO').toUpperCase();
  return fallback;
}

function normalizeText(value: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBankCode(bankId: string | null): string | null {
  if (!bankId) return null;
  const digits = bankId.replace(/\D/g, '').replace(/^0+/, '');
  return digits || null;
}

function identifyBankFromName(bankName: string | null): { key: string; name: string } | null {
  const normalized = normalizeText(bankName);

  if (!normalized) return null;
  if (normalized.includes('BRADESCO')) return { key: 'bradesco', name: 'Bradesco' };
  if (normalized.includes('BANCO DO BRASIL') || normalized === 'BB') return { key: 'banco-do-brasil', name: 'Banco do Brasil' };
  if (normalized.includes('SICREDI') || normalized.includes('SICREED')) return { key: 'sicredi', name: 'Sicredi' };
  if (normalized.includes('INTER')) return { key: 'inter', name: 'Inter' };
  if (normalized.includes('NUBANK') || normalized.includes('NU PAGAMENTOS')) return { key: 'nubank', name: 'Nubank' };
  if (normalized.includes('ITAU')) return { key: 'itau', name: 'Itau' };
  if (normalized.includes('SANTANDER')) return { key: 'santander', name: 'Santander' };
  if (normalized.includes('CAIXA')) return { key: 'caixa', name: 'Caixa' };

  return null;
}

function extractBankInfo(content: string, expectedBankName?: string | null): ParsedBankInfo {
  const bankId = extractTagValue(content, 'BANKID');
  const bankByCode = BANKS_BY_CODE[normalizeBankCode(bankId) ?? ''];
  const bankByName = identifyBankFromName(expectedBankName ?? null);

  return {
    bankId,
    bankName: bankByCode?.name ?? bankByName?.name ?? null,
    bankKey: bankByCode?.key ?? bankByName?.key ?? null,
    accountId: extractTagValue(content, 'ACCTID'),
    accountType: extractTagValue(content, 'ACCTTYPE')
  };
}

function isBalanceTransaction(memo: string | null): boolean {
  const normalized = normalizeText(memo);

  return (
    normalized === 'SALDO ANTERIOR' ||
    normalized === 'SALDO DO DIA' ||
    normalized === 'SALDO FINAL' ||
    normalized === 'SALDO TOTAL DISPONIVEL DIA'
  );
}

function normalizeAccountNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

function sameAccountNumber(ofxAccountId: string | null, expectedAccountNumber: string | null | undefined): boolean {
  const ofx = normalizeAccountNumber(ofxAccountId);
  const expected = normalizeAccountNumber(expectedAccountNumber);

  if (!ofx || !expected) return true;
  return ofx === expected || ofx.endsWith(expected) || expected.endsWith(ofx);
}

function buildWarnings(bank: ParsedBankInfo, options: ParseOFXOptions): string[] {
  const warnings: string[] = [];
  const expectedBank = identifyBankFromName(options.expectedBankName ?? null);

  if (expectedBank && bank.bankKey && expectedBank.key !== bank.bankKey) {
    warnings.push(`Banco detectado no OFX: ${bank.bankName ?? bank.bankId}. Conta selecionada: ${options.expectedBankName}.`);
  }

  if (!sameAccountNumber(bank.accountId, options.expectedAccountNumber)) {
    warnings.push(`Conta detectada no OFX: ${bank.accountId}. Conta selecionada: ${options.expectedAccountNumber}.`);
  }

  return warnings;
}

export function parseOFX(buffer: Buffer, options: ParseOFXOptions = {}): ParsedStatement {
  const content = decodeOfxBuffer(buffer);
  const bank = extractBankInfo(content, options.expectedBankName);

  const periodStartTag = extractTagValue(content, 'DTSTART');
  const periodEndTag = extractTagValue(content, 'DTEND');

  const ledgerMatch = content.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i);
  const finalBalance = parseOfxAmount(ledgerMatch?.[1] ?? null) ?? 0;

  const transactionBlocks = Array.from(content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi));

  const rawTransactions: RawTransaction[] = transactionBlocks
    .map((match, index) => {
      const block = match[1];

      const posted = parseOfxDate(extractTagValue(block, 'DTPOSTED'));
      if (!posted) return null;

      const signedAmount = parseOfxAmount(extractTagValue(block, 'TRNAMT'));
      if (signedAmount === null || signedAmount === 0) return null;

      const typeTag = extractTagValue(block, 'TRNTYPE');
      const memo = extractTagValue(block, 'MEMO');
      const fitId = extractTagValue(block, 'FITID');
      const checkNum = extractTagValue(block, 'CHECKNUM');

      if (isBalanceTransaction(memo)) {
        return null;
      }

      return {
        id: `${fitId || checkNum || posted.key}-${index}`,
        postedKey: posted.key,
        date: posted.date,
        description: normalizeDescription(memo, typeTag),
        documentNumber: checkNum || fitId || '',
        type: inferType(typeTag, signedAmount),
        amount: Math.abs(signedAmount),
        signedAmount
      };
    })
    .filter((transaction): transaction is RawTransaction => transaction !== null);

  if (rawTransactions.length === 0) {
    throw new Error('Nao foi possivel identificar transacoes no arquivo OFX.');
  }

  const netChange = rawTransactions.reduce((sum, tx) => sum + tx.signedAmount, 0);
  const initialBalance = finalBalance - netChange;

  const sortedAsc = [...rawTransactions].sort((a, b) => a.postedKey - b.postedKey);
  let runningBalance = initialBalance;
  const balanceByTransaction = new Map<string, number>();

  for (const transaction of sortedAsc) {
    runningBalance += transaction.signedAmount;
    balanceByTransaction.set(transaction.id, Number(runningBalance.toFixed(2)));
  }

  const transactions: ParsedTransaction[] = rawTransactions.map((transaction) => ({
    date: transaction.date,
    description: transaction.description,
    documentNumber: transaction.documentNumber,
    type: transaction.type,
    amount: Number(transaction.amount.toFixed(2)),
    balanceAfter: balanceByTransaction.get(transaction.id) ?? 0
  }));

  const minDate = sortedAsc[0]?.date;
  const maxDate = sortedAsc[sortedAsc.length - 1]?.date;

  return {
    periodStart: minDate ?? parseOfxDate(periodStartTag)?.date,
    periodEnd: maxDate ?? parseOfxDate(periodEndTag)?.date,
    initialBalance: Number(initialBalance.toFixed(2)),
    finalBalance: Number(finalBalance.toFixed(2)),
    bank,
    warnings: buildWarnings(bank, options),
    transactions
  };
}
