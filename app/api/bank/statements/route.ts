import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get('bankAccountId');
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  const statements = await prisma.bankStatement.findMany({
    where: {
      companyId: session.companyId,
      ...(bankAccountId ? { bankAccountId } : {})
    },
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
      _count: { select: { bankMoves: true } }
    },
    orderBy: { importedAt: 'desc' },
    take: Number.isFinite(limit) ? limit : 20
  });

  return NextResponse.json(statements);
}
