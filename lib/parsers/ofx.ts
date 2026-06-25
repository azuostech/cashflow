import { createHash } from 'crypto';
import { normalizeDescription } from '@/lib/utils/normalize';
import type { ParsedMove, ParseResult } from './types';

const BANK_CODES: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '077': 'Inter',
  '104': 'Caixa Economica',
  '237': 'Bradesco',
  '260': 'Nubank',
  '341': 'Itau',
  '748': 'Sicredi'
};

const SALDO_KEYWORDS = [
  'SALDO ANTERIOR',
  'SALDO DO DIA',
  'SALDO FINAL',
  'SALDO TOTAL DISPONIVEL',
  'SALDO DISPONIVEL'
];

function normalizeBankCode(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length <= 3 ? digits.padStart(3, '0') : digits;
}

function isSaldoEntry(description: string): boolean {
  const upper = description.toUpperCase();
  return SALDO_KEYWORDS.some((keyword) => upper.includes(keyword));
}

function parseOFXDate(value: string): Date {
  const clean = value.replace(/\[.*\]/, '').trim();
  const year = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day = clean.slice(6, 8);
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

function extractBradescoOperationDate(memo: string, postedDate: Date): Date | null {
  const match =
    memo.match(/\bDT\s+(\d{2}\/\d{2}(?:\/\d{4})?)\b/i) ??
    memo.match(/\b(\d{2}\/\d{2}\/\d{4})\b/) ??
    memo.match(/\b(\d{2}\/\d{2})\b/);

  if (!match) return null;

  const [day, month, yearValue] = match[1].split('/');
  const year = yearValue ?? postedDate.getUTCFullYear().toString();
  const candidate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const diff = Math.abs(candidate.getTime() - postedDate.getTime());

  return diff <= 3 * 86400000 ? candidate : null;
}

function decodeOFX(buffer: Buffer): string {
  const utf8 = buffer.toString('utf-8');
  const latin1 = buffer.toString('latin1');
  const utf8Replacements = (utf8.match(/\uFFFD/g) ?? []).length;
  const latin1Replacements = (latin1.match(/\uFFFD/g) ?? []).length;

  return utf8Replacements <= latin1Replacements ? utf8 : latin1;
}

function extractField(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseAmount(raw: string): number {
  return Math.abs(Number(raw.replace(',', '.').trim()) || 0);
}

function getTransactionBlocks(content: string): string[] {
  const closedBlocks = Array.from(content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)).map((match) => match[1]);
  if (closedBlocks.length > 0) return closedBlocks;

  return content
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((part) => part.split(/<STMTTRN>|<\/BANKTRANLIST>|<\/STMTRS>/i)[0] ?? '')
    .filter(Boolean);
}

export function parseOFX(
  buffer: Buffer,
  options?: {
    expectedBankId?: string | null;
    expectedAccountId?: string | null;
  }
): ParseResult {
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const content = decodeOFX(buffer);
  const warnings: string[] = [];

  const bankId = extractField(content, 'BANKID');
  const accountId = extractField(content, 'ACCTID');
  const currency = extractField(content, 'CURDEF') ?? 'BRL';
  const bankCode = bankId ? normalizeBankCode(bankId) : null;
  const bankName = bankCode ? BANK_CODES[bankCode] ?? `Banco ${bankId}` : null;
  const expectedBankCode = options?.expectedBankId ? normalizeBankCode(options.expectedBankId) : null;

  if (expectedBankCode && bankCode && bankCode !== expectedBankCode) {
    warnings.push(`Banco do arquivo (${bankId} - ${bankName}) diverge da conta selecionada (${options?.expectedBankId})`);
  }

  if (options?.expectedAccountId && accountId && accountId !== options.expectedAccountId) {
    warnings.push(`Conta do arquivo (${accountId}) diverge da conta selecionada (${options.expectedAccountId})`);
  }

  const balanceValue = extractField(content, 'BALAMT');
  const balanceFinal = balanceValue ? Number(balanceValue.replace(',', '.')) : null;
  const blocks = getTransactionBlocks(content);
  const moves: ParsedMove[] = [];
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  for (const block of blocks) {
    const dtPosted = extractField(block, 'DTPOSTED');
    const amountRaw = extractField(block, 'TRNAMT');
    const fitid = extractField(block, 'FITID');
    const checknum = extractField(block, 'CHECKNUM');
    const memo = extractField(block, 'MEMO') ?? extractField(block, 'NAME') ?? '';

    if (!dtPosted || !amountRaw || isSaldoEntry(memo)) continue;

    const signedAmount = Number(amountRaw.replace(',', '.').trim()) || 0;
    const postedDate = parseOFXDate(dtPosted);
    const operationDate = extractBradescoOperationDate(memo, postedDate);
    const date = operationDate ?? postedDate;
    const { normalized, merchantName, merchantDocument } = normalizeDescription(memo);

    moves.push({
      date,
      postedDate,
      operationDate,
      amount: parseAmount(amountRaw),
      type: signedAmount >= 0 ? 'credit' : 'debit',
      description: memo,
      descriptionNormalized: normalized,
      merchantName,
      merchantDocument,
      bankRef: fitid ?? checknum ?? null,
      balanceAfter: null,
      rawMemo: memo
    });

    if (!periodStart || date < periodStart) periodStart = date;
    if (!periodEnd || date > periodEnd) periodEnd = date;
  }

  if (balanceFinal !== null && moves.length > 0) {
    let runningBalance = balanceFinal;
    for (let index = moves.length - 1; index >= 0; index -= 1) {
      moves[index].balanceAfter = runningBalance;
      runningBalance -= moves[index].type === 'credit' ? moves[index].amount : -moves[index].amount;
    }
  }

  return {
    moves,
    bankId,
    bankName,
    accountId,
    periodStart,
    periodEnd,
    currency,
    warnings,
    fileHash
  };
}
