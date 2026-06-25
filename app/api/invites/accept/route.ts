import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({ token: z.string().uuid() });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Token invalido' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = await prisma.userCompanyRole.findFirst({
    where: {
      id: parsed.data.token,
      userId: user.id,
      acceptedAt: null,
      active: true
    },
    include: { company: true }
  });

  if (!role) {
    return NextResponse.json({ error: 'Convite nao encontrado ou ja aceito' }, { status: 404 });
  }

  await prisma.userCompanyRole.update({
    where: { id: role.id },
    data: { acceptedAt: new Date() }
  });

  return NextResponse.json({
    companyId: role.companyId,
    companyName: role.company.name,
    role: role.role
  });
}
