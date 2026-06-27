import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireSupabaseConfig } from './env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export function createClient() {
  const cookieStore = cookies();
  const { supabaseUrl, supabasePublicKey } = requireSupabaseConfig();

  return createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always mutate cookies; Route Handlers can.
          }
        }
      }
    }
  );
}
