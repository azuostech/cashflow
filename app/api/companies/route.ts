import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/utils/audit';
import { formatCNPJ } from '@/lib/utils/cnpj';
import { createCompanySchema } from '@/lib/validations/company.schema';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const cleanDocument = data.document.replace(/\D/g, '');
  const existing = await prisma.company.findUnique({ where: { document: cleanDocument } });

  if (existing) {
    return NextResponse.json({ error: 'CNPJ ja cadastrado' }, { status: 409 });
  }

  const nameFromMetadata = user.user_metadata?.name;
  const displayName =
    typeof nameFromMetadata === 'string' && nameFromMetadata.trim().length > 0
      ? nameFromMetadata.trim()
      : user.email?.split('@')[0] ?? 'Usuario';

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? '',
      name: displayName,
      active: true
    },
    create: {
      id: user.id,
      email: user.email ?? '',
      name: displayName,
      active: true
    }
  });

  const company = await prisma.$transaction(async (tx) => {
    const newCompany = await tx.company.create({
      data: {
        name: data.name,
        legalName: data.legalName ?? null,
        document: cleanDocument,
        baseCurrency: data.baseCurrency,
        country: data.country ?? 'BR',
        timezone: data.timezone,
        fiscalYearStart: data.fiscalYearStart
      }
    });

    await tx.userCompanyRole.create({
      data: {
        userId: user.id,
        companyId: newCompany.id,
        role: 'owner',
        active: true,
        acceptedAt: new Date()
      }
    });

    return newCompany;
  });

  cookies().set('cf_active_company', company.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });

  await createAuditLog({
    companyId: company.id,
    userId: user.id,
    action: 'create',
    entityType: 'company',
    entityId: company.id,
    afterData: { name: company.name, document: formatCNPJ(company.document) },
    request
  });

  return NextResponse.json({ id: company.id, name: company.name }, { status: 201 });
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roles = await prisma.userCompanyRole.findMany({
    where: { userId: user.id, active: true },
    include: { company: true },
    orderBy: { acceptedAt: 'asc' }
  });

  return NextResponse.json(
    roles.map((role) => ({
      id: role.company.id,
      name: role.company.name,
      legalName: role.company.legalName,
      document: role.company.document,
      role: role.role,
      baseCurrency: role.company.baseCurrency,
      country: role.company.country,
      sector: role.company.sector,
      size: role.company.size,
      fiscalYearStart: role.company.fiscalYearStart,
      timezone: role.company.timezone,
      active: role.company.active,
      createdAt: role.company.createdAt,
      updatedAt: role.company.updatedAt
    }))
  );
}
