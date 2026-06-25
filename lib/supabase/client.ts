import { createBrowserClient } from '@supabase/ssr';

export const SUPABASE_BROWSER_CONFIG_ERROR =
  'Supabase nao configurado. Crie .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.';

export function isSupabaseBrowserConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createClient() {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error(SUPABASE_BROWSER_CONFIG_ERROR);
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );
}
