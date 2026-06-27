import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicKey, getSupabaseUrl } from './lib/supabase/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback', '/invite'];
  const guestOnlyRoutes = ['/login', '/register', '/forgot-password'];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isGuestOnlyRoute = guestOnlyRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (pathname === '/api/health') {
    return NextResponse.next({ request });
  }

  const supabaseUrl = getSupabaseUrl();
  const supabasePublicKey = getSupabasePublicKey();

  if (!supabaseUrl || !supabasePublicKey) {
    if (!isPublicRoute) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isGuestOnlyRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
