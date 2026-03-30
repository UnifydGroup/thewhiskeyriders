import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname;

  // Check if the route is protected
  const protectedRoutes = ['/dashboard', '/trips', '/profile', '/gallery', '/admin'];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Allow passage - auth is handled client-side
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
};
