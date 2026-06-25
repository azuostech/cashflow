import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { exportDREToExcel } from '@/lib/exports/dre-excel';
import { prisma } from '@/lib/prisma';
import { calculateDRE } from '@/lib/reports/dre';
import { getSessionContext, isSessionError } from '@/lib/session';

const schema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  compareStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compareEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  costCenterId: z.string().uuid().optional()
});

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const query = parsed.data;
  const [company, dre, compareDre] = await Promise.all([
    prisma.company.findUnique({ where: { id: session.companyId }, select: { name: true } }),
    calculateDRE(session.companyId, parseDateOnly(query.startDate), parseDateOnly(query.endDate), query.costCenterId),
    query.compareStart && query.compareEnd
      ? calculateDRE(session.companyId, parseDateOnly(query.compareStart), parseDateOnly(query.compareEnd), query.costCenterId)
      : Promise.resolve(undefined)
  ]);

  const buffer = exportDREToExcel(dre, compareDre, company?.name);
  const filename = `DRE_${query.startDate}_${query.endDate}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
