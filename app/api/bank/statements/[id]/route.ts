import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const statement = await prisma.bankStatement.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: {
      bankAccount: {
        select: {
          id: true,
          name: true,
          currency: true,
          bankProvider: { select: { id: true, name: true } }
        }
      },
      importMapping: { select: { id: true, name: true } },
      bankMoves: {
        orderBy: { date: 'asc' },
        take: 200,
        select: {
          id: true,
          date: true,
          type: true,
          description: true,
          originalAmount: true,
          originalCurrency: true,
          reconciliationStatus: true,
          isPossibleDuplicate: true,
          merchantName: true
        }
      },
      _count: { select: { bankMoves: true } }
    }
  });

  if (!statement) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(statement);
}
