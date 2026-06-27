import { createBrowserClient } from '@supabase/ssr';
import {
  getSupabasePublicKey,
  getSupabaseUrl,
  isSupabaseConfigured,
  SUPABASE_PUBLIC_KEY_ENV_NAMES
} from './env';

export const SUPABASE_BROWSER_CONFIG_ERROR =
  `Supabase nao configurado. Crie .env.local com NEXT_PUBLIC_SUPABASE_URL e ${SUPABASE_PUBLIC_KEY_ENV_NAMES}.`;

export function isSupabaseBrowserConfigured() {
  return isSupabaseConfigured();
}

export function createClient() {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error(SUPABASE_BROWSER_CONFIG_ERROR);
  }

  return createBrowserClient(
    getSupabaseUrl() as string,
    getSupabasePublicKey() as string
  );
}
