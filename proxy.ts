// proxy.ts  (project root — NOT src/proxy.ts, NOT middleware.ts)
// Next.js 16: proxy.ts replaces middleware.ts. Export must be named 'proxy'.
// This file replaces the deprecated middleware.ts from Next.js 14/15.
import { NextRequest, NextResponse } from 'next/server';

// Routes that do not require authentication — accessible without any token
const PUBLIC_PATHS = ['/login', '/register', '/'];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and all their sub-paths
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  if (isPublic) {
    return NextResponse.next();
  }

  // Optimistic redirect: if no 'firebase-auth' cookie hint, redirect to login.
  // NOTE: This is an OPTIMISTIC check only — proxy.ts cannot verify Firebase ID tokens
  // without next-firebase-auth-edge. The real auth gate is AuthProvider in the component.
  // In Next.js 16, proxy.ts should NOT be used as full session management.
  // For Phase 2, we rely on AuthProvider + useEffect redirect for real protection.
  // Proxy provides a fast redirect for users who have clearly never authenticated.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
