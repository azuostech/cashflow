export interface ParsedMove {
  date: Date;
  postedDate: Date;
  operationDate: Date | null;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  descriptionNormalized: string;
  merchantName: string | null;
  merchantDocument: string | null;
  bankRef: string | null;
  balanceAfter: number | null;
  rawMemo: string | null;
}

export interface ParseResult {
  moves: ParsedMove[];
  bankId: string | null;
  bankName: string | null;
  accountId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  currency: string;
  warnings: string[];
  fileHash: string;
}

export interface DuplicateResult {
  isDuplicate: boolean;
  type: 'hard' | 'soft' | null;
  existingId: string | null;
  existingImportedAt: Date | null;
}
