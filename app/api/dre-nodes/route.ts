import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const includeSubtotals = searchParams.get('includeSubtotals') !== 'false';

  const nodes = await prisma.dRENode.findMany({
    where: {
      OR: [{ isGlobal: true }, { companyId: session.companyId }],
      active: true,
      ...(includeSubtotals ? {} : { isSubtotal: false })
    },
    orderBy: { sortOrder: 'asc' }
  });

  return NextResponse.json(nodes);
}
