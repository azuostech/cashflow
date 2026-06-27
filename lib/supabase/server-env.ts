import 'server-only';

import type { SupabaseEnv } from '@supabase/server';
import { getSupabasePublicKey, getSupabaseUrl } from './env';

export function getSupabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function getSupabaseJwksUrl() {
  const explicitUrl = process.env.SUPABASE_JWKS_URL;
  if (explicitUrl) return explicitUrl;

  const supabaseUrl = getSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : undefined;
}

export function resolveSupabaseServerEnv(): Partial<SupabaseEnv> {
  const supabaseUrl = getSupabaseUrl();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? getSupabasePublicKey();
  const secretKey = getSupabaseSecretKey();
  const jwksUrl = getSupabaseJwksUrl();

  const env: Partial<SupabaseEnv> = {};

  if (supabaseUrl) env.url = supabaseUrl;
  if (publishableKey) env.publishableKeys = { default: publishableKey };
  if (secretKey) env.secretKeys = { default: secretKey };
  if (!process.env.SUPABASE_JWKS && jwksUrl) env.jwks = new URL(jwksUrl);

  return env;
}
