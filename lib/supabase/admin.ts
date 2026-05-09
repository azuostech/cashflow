import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Supabase service role ausente no ambiente.');
  }

  // Guardrail for common misconfiguration where a URL is pasted instead of the secret key.
  if (serviceRole.startsWith('http://') || serviceRole.startsWith('https://')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY invalida: foi informado uma URL. Use a chave secreta service_role (sb_secret_...) no .env.local.'
    );
  }

  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
