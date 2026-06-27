import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getHomeRoute } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireSupabaseConfig } from '@/lib/supabase/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function safeInternalPath(value: string | null): string {
  if (value?.startsWith('/') && !value.startsWith('//')) return value;
  return '/dashboard';
}

function shouldUseHomeRoute(next: string): boolean {
  return next === '/' || next === '/dashboard';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeInternalPath(searchParams.get('next'));

  if (code) {
    const cookieStore = cookies();
    const { supabaseUrl, supabasePublicKey } = requireSupabaseConfig();
    const supabase = createServerClient(
      supabaseUrl,
      supabasePublicKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      let role = null;
      let homeRoute = '/dashboard';

      try {
        role = user
          ? await prisma.userCompanyRole.findFirst({
              where: { userId: user.id, active: true },
              orderBy: { acceptedAt: 'asc' }
            })
          : null;
        homeRoute = role ? getHomeRoute(role.role) : '/onboarding';
      } catch (error) {
        console.error('Auth callback role lookup error:', error);
      }

      const response = NextResponse.redirect(`${origin}${shouldUseHomeRoute(next) ? homeRoute : next}`);

      if (role) {
        response.cookies.set('cf_active_company', role.companyId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30
        });
        response.cookies.set('cf_home_route', homeRoute, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30
        });
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
