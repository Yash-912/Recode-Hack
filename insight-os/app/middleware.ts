// ─── Auth Middleware ───────────────────────────────────────
// Protects /dashboard routes — redirects unauthenticated users to /login

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/funnels') ||
      pathname.startsWith('/heatmap') || pathname.startsWith('/sessions') ||
      pathname.startsWith('/live-map')) {
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/funnels/:path*', '/heatmap/:path*', '/sessions/:path*', '/live-map/:path*'],
};
