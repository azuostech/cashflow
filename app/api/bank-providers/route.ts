import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providers = await prisma.bankProvider.findMany({
    where: { isGlobal: true, active: true },
    orderBy: [{ country: 'asc' }, { name: 'asc' }]
  });

  return NextResponse.json(providers);
}
