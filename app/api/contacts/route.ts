import { ContactType } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createAuditLog } from '@/lib/utils/audit';
import { createContactSchema } from '@/lib/validations/settings.schema';

export async function GET(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const search = searchParams.get('search');
  const activeParam = searchParams.get('active');

  const contacts = await prisma.contact.findMany({
    where: {
      companyId: session.companyId,
      ...(activeParam === 'all' ? {} : { active: true }),
      ...(type ? { type: type as ContactType } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { document: { contains: search } },
              { email: { contains: search, mode: 'insensitive' } }
            ]
          }
        : {})
    },
    orderBy: { name: 'asc' }
  });

  const txCounts = await prisma.transaction.groupBy({
    by: ['contactId'],
    where: {
      companyId: session.companyId,
      contactId: { in: contacts.map((contact) => contact.id) },
      deletedAt: null
    },
    _count: true
  });

  const countMap = Object.fromEntries(txCounts.map((item) => [item.contactId, item._count]));

  return NextResponse.json(
    contacts.map((contact) => ({
      ...contact,
      transactionCount: countMap[contact.id] ?? 0
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = createContactSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const contact = await prisma.contact.create({
    data: {
      companyId: session.companyId,
      name: data.name,
      type: data.type as ContactType,
      document: data.document ? data.document.replace(/\D/g, '') || null : null,
      email: data.email || null,
      phone: data.phone ?? null,
      active: true
    }
  });

  await createAuditLog({
    companyId: session.companyId,
    userId: session.userId,
    action: 'create',
    entityType: 'contact',
    entityId: contact.id,
    afterData: contact as unknown as Record<string, unknown>,
    request
  });

  return NextResponse.json(contact, { status: 201 });
}
