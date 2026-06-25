import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { findMatches } from '@/lib/matching/engine';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const move = await prisma.bankMove.findFirst({
    where: { id: params.id, companyId: session.companyId }
  });

  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (move.reconciliationStatus === 'reconciled') return NextResponse.json([]);

  const matches = await findMatches(params.id, session.companyId);

  await prisma.reconciliationSuggestion.updateMany({
    where: {
      companyId: session.companyId,
      bankMoveId: params.id,
      status: 'pending'
    },
    data: {
      status: 'expired'
    }
  });

  if (matches.length > 0) {
    await prisma.reconciliationSuggestion.createMany({
      data: matches.map((match) => ({
        companyId: session.companyId,
        bankMoveId: params.id,
        transactionId: match.candidate.transactionId,
        installmentId: match.candidate.installmentId,
        confidence: new Prisma.Decimal(match.score.toFixed(4)),
        reasons: match.reasons,
        canCreateTransaction: false,
        status: 'pending'
      }))
    });
  }

  return NextResponse.json(
    matches.map((match) => ({
      transactionId: match.candidate.transactionId,
      installmentId: match.candidate.installmentId,
      description: match.candidate.description,
      amount: match.candidate.amount,
      currency: match.candidate.currency,
      dueDate: match.candidate.dueDate,
      status: match.candidate.status,
      categoryName: match.candidate.categoryName,
      contactName: match.candidate.contactName,
      confidence: match.confidence,
      reasons: match.reasons
    }))
  );
}
