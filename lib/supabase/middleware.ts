import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<ReturnType<typeof NextResponse.next>['cookies']['set']>[2];
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/notes') ||
    pathname.startsWith('/groups') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/settings');
  const isAuthPage =
    pathname.startsWith('/auth/sign-in') ||
    pathname.startsWith('/auth/sign-up') ||
    pathname.startsWith('/auth/forgot-password');

  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth/sign-in';
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthPage) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/notes';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
