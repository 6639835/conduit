import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isLoggedIn = !!token;
  const { pathname } = request.nextUrl;

  const isOnAdminRoute = pathname.startsWith('/admin');
  const isOnLoginPage = pathname.startsWith('/login');

  if (isOnAdminRoute) {
    if (isLoggedIn) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isOnLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};

