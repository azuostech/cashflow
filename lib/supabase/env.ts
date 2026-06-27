export const SUPABASE_PUBLIC_KEY_ENV_NAMES =
  'NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou SUPABASE_PUBLISHABLE_KEY';

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
}

export function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

export function requireSupabaseConfig() {
  const supabaseUrl = getSupabaseUrl();
  const supabasePublicKey = getSupabasePublicKey();

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(`Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e ${SUPABASE_PUBLIC_KEY_ENV_NAMES}.`);
  }

  return { supabaseUrl, supabasePublicKey };
}
