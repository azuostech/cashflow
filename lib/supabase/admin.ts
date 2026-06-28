import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';
import { getSupabaseSecretKey } from './server-env';

export function createSupabaseAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();

  if (!supabaseUrl || !secretKey) return null;

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
