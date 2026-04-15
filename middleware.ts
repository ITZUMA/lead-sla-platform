import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow webhook and cron API routes (no auth needed)
  if (pathname.startsWith('/api/webhook') || pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // Allow auth routes
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/signin')) {
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!req.auth) {
    const signInUrl = new URL('/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
