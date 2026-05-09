import { createClient } from '@/lib/supabase/server';
import { jsonOk } from '@/lib/utils/http';

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return jsonOk({ success: true });
}
