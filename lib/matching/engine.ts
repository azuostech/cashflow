import {
  BankMoveType,
  ReconciliationStatus,
  TransactionStatus,
  TransactionType
} from '@prisma/client';
import { addDays, differenceInDays, subDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { normalizeDescription } from '@/lib/utils/normalize';

export interface MatchCandidate {
  transactionId: string | null;
  installmentId: string | null;
  description: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: string;
  categoryName: string | null;
  contactName: string | null;
  contactDocument: string | null;
}

export interface MatchResult {
  candidate: MatchCandidate;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

function scoreAmount(moveAmount: number, txAmount: number): number {
  const normalizedMove = Math.abs(moveAmount);
  const normalizedTx = Math.abs(txAmount);
  const diff = Math.abs(normalizedMove - normalizedTx) / Math.max(normalizedMove, 0.01);

  if (diff === 0) return 1;
  if (diff <= 0.001) return 0.9;
  if (diff <= 0.01) return 0.7;
  if (diff <= 0.05) return 0.4;
  return 0;
}

function scoreDate(moveDate: Date, dueDate: Date): number {
  const days = Math.abs(differenceInDays(moveDate, dueDate));

  if (days === 0) return 1;
  if (days === 1) return 0.8;
  if (days <= 3) return 0.6;
  if (days <= 7) return 0.3;
  if (days <= 15) return 0.1;
  return 0;
}

function scoreContact(moveDocument: string | null, contactDocument: string | null): number {
  if (!moveDocument || !contactDocument) return 0;

  const clean = (value: string) => value.replace(/\D/g, '');
  return clean(moveDocument) === clean(contactDocument) ? 1 : 0;
}

function scoreDescription(moveNormalized: string | null, txNormalized: string | null): number {
  if (!moveNormalized || !txNormalized) return 0;

  const a = moveNormalized.toLowerCase();
  const b = txNormalized.toLowerCase();

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.6;

  const wordsA = new Set(a.split(/\s+/).filter((word) => word.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter((word) => word.length > 3));
  const common = Array.from(wordsA).filter((word) => wordsB.has(word)).length;
  const total = Math.max(wordsA.size, wordsB.size, 1);

  return common / total >= 0.5 ? 0.4 : 0;
}

function calculateScore(
  moveAmount: number,
  moveDate: Date,
  moveDocument: string | null,
  moveNormalized: string | null,
  candidate: MatchCandidate
): { score: number; reasons: string[] } {
  const amountScore = scoreAmount(moveAmount, candidate.amount);
  const dateScore = scoreDate(moveDate, candidate.dueDate);
  const contactScore = scoreContact(moveDocument, candidate.contactDocument);
  const descriptionScore = scoreDescription(moveNormalized, candidate.description);

  const score = 0.4 * amountScore + 0.25 * dateScore + 0.2 * contactScore + 0.15 * descriptionScore;
  const reasons: string[] = [];

  if (amountScore === 1) reasons.push('Valor exato');
  else if (amountScore > 0) reasons.push(`Valor proximo (${(amountScore * 100).toFixed(0)}%)`);

  if (dateScore === 1) reasons.push('Mesma data');
  else if (dateScore > 0) reasons.push(`Data proxima (${Math.abs(differenceInDays(moveDate, candidate.dueDate))} dias)`);

  if (contactScore === 1) reasons.push('CNPJ/CPF identico');
  if (descriptionScore > 0) reasons.push('Descricao similar');

  return { score, reasons };
}

export function confidenceLabel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'high';
  if (score >= 0.6) return 'medium';
  return 'low';
}

function normalizedDescription(value: string | null): string | null {
  if (!value) return null;
  return normalizeDescription(value).normalized || null;
}

export async function findMatches(bankMoveId: string, companyId: string): Promise<MatchResult[]> {
  const move = await prisma.bankMove.findFirst({
    where: { id: bankMoveId, companyId }
  });

  if (!move) return [];

  const moveAmount = Number(move.originalAmount);
  const moveDate = move.date;
  const windowStart = subDays(moveDate, 30);
  const windowEnd = addDays(moveDate, 30);
  const expectedType = move.type === BankMoveType.credit ? TransactionType.revenue : TransactionType.expense;

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      type: expectedType,
      reconciliationStatus: { not: ReconciliationStatus.reconciled },
      deletedAt: null,
      status: { not: TransactionStatus.cancelled },
      dueDate: { gte: windowStart, lte: windowEnd }
    },
    include: {
      category: { select: { name: true } },
      contact: { select: { name: true, document: true } }
    },
    take: 50
  });

  const installments = await prisma.installment.findMany({
    where: {
      companyId,
      reconciliationStatus: { not: ReconciliationStatus.reconciled },
      status: { not: TransactionStatus.cancelled },
      dueDate: { gte: windowStart, lte: windowEnd },
      transaction: {
        type: expectedType,
        deletedAt: null
      }
    },
    include: {
      transaction: {
        include: {
          contact: { select: { name: true, document: true } },
          category: { select: { name: true } }
        }
      }
    },
    take: 30
  });

  const candidates: MatchCandidate[] = [
    ...transactions.map((transaction) => ({
      transactionId: transaction.id,
      installmentId: null,
      description: transaction.descriptionNormalized ?? normalizedDescription(transaction.description) ?? transaction.description,
      amount: Number(transaction.originalAmount),
      currency: transaction.originalCurrency,
      dueDate: transaction.dueDate,
      status: transaction.status,
      categoryName: transaction.category?.name ?? null,
      contactName: transaction.contact?.name ?? null,
      contactDocument: transaction.contact?.document ?? null
    })),
    ...installments.map((installment) => ({
      transactionId: null,
      installmentId: installment.id,
      description:
        installment.transaction.descriptionNormalized ??
        normalizedDescription(installment.transaction.description) ??
        installment.transaction.description,
      amount: Number(installment.originalAmount),
      currency: installment.originalCurrency,
      dueDate: installment.dueDate,
      status: installment.status,
      categoryName: installment.transaction.category?.name ?? null,
      contactName: installment.transaction.contact?.name ?? null,
      contactDocument: installment.transaction.contact?.document ?? null
    }))
  ];

  return candidates
    .map((candidate) => {
      const { score, reasons } = calculateScore(
        moveAmount,
        moveDate,
        move.merchantDocument,
        move.descriptionNormalized ?? normalizedDescription(move.description),
        candidate
      );

      return { candidate, score, confidence: confidenceLabel(score), reasons };
    })
    .filter((result) => result.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
