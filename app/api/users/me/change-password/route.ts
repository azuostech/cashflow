import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext, isSessionError } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { changePasswordSchema } from '@/lib/users/profile';

export async function POST(request: NextRequest) {
  const session = await getSessionContext();
  if (isSessionError(session)) return session;

  const body = await request.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ changed: true });
}
