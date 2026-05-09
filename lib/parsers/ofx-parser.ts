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

function extractTagValue(content: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const match = content.match(regex);
  return match?.[1]?.trim() || null;
}

function parseOfxAmount(value: string | null): number | null {
  if (!value) return null;

  const normalized = value.replace(',', '.').trim();
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

export function parseOFX(buffer: Buffer): ParsedStatement {
  const content = buffer.toString('latin1');

  const periodStartTag = extractTagValue(content, 'DTSTART');
  const periodEndTag = extractTagValue(content, 'DTEND');
  const periodStartParsed = parseOfxDate(periodStartTag);
  const periodEndParsed = parseOfxDate(periodEndTag);

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

      return {
        id: fitId || `${posted.key}-${index}`,
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
    periodStart: periodStartParsed?.date ?? minDate,
    periodEnd: periodEndParsed?.date ?? maxDate,
    initialBalance: Number(initialBalance.toFixed(2)),
    finalBalance: Number(finalBalance.toFixed(2)),
    transactions
  };
}
