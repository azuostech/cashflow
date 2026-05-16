import { cookies } from 'next/headers';
import { ACTIVE_COMPANY_COOKIE } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { jsonOk } from '@/lib/utils/http';

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  cookies().delete(ACTIVE_COMPANY_COOKIE);
  return jsonOk({ success: true });
}
