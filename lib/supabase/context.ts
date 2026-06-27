import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import {
  createAdminClient,
  createContextClient,
  verifyCredentials
} from '@supabase/server/core';
import type { AuthModeWithKey, SupabaseContext } from '@supabase/server';
import { cookies } from 'next/headers';
import { resolveSupabaseServerEnv } from './server-env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

type CreateSupabaseContextOptions = {
  auth?: AuthModeWithKey | AuthModeWithKey[];
};

type SupabaseContextResult<Database> =
  | { data: SupabaseContext<Database>; error: null }
  | { data: null; error: Error };

export async function createSupabaseContext<Database = unknown>(
  options: CreateSupabaseContextOptions = { auth: 'user' }
): Promise<SupabaseContextResult<Database>> {
  const env = resolveSupabaseServerEnv();
  const publishableKey = env.publishableKeys?.default;

  if (!env.url || !publishableKey) {
    return {
      data: null,
      error: new Error('Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.')
    };
  }

  const cookieStore = cookies();
  const ssrClient = createServerClient(env.url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // Server Components cannot mutate cookies; middleware refreshes sessions.
        }
      }
    }
  });

  const {
    data: { session }
  } = await ssrClient.auth.getSession();

  const { data: auth, error } = await verifyCredentials(
    { token: session?.access_token ?? null, apikey: null },
    { auth: options.auth ?? 'user', env }
  );

  if (error) return { data: null, error };

  try {
    const supabase = createContextClient<Database>({
      auth: { token: auth.token, keyName: auth.keyName },
      env
    });
    const supabaseAdmin = createAdminClient<Database>({
      auth: { keyName: auth.keyName },
      env
    });

    return {
      data: {
        supabase,
        supabaseAdmin,
        userClaims: auth.userClaims,
        jwtClaims: auth.jwtClaims,
        authMode: auth.authMode,
        authKeyName: auth.keyName ?? undefined
      },
      error: null
    };
  } catch (cause) {
    return {
      data: null,
      error: cause instanceof Error ? cause : new Error('Falha ao criar clientes Supabase.')
    };
  }
}
