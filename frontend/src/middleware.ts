// AutomatedTradeBot - Server-Side Route Protection
// This middleware runs on the Edge Runtime before requests are processed
// Learn more: https://nextjs.org/docs/app/building-your-application/routing/middleware

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/subscriptions',
  '/positions',
  '/signals',
  '/analytics',
  '/transactions',
  '/risk-management',
  '/profile',
  '/settings',
  '/backtests',
  '/news-calendar',
  '/notifications',
];

// Define provider-only routes
const providerRoutes = [
  '/provider/dashboard',
  '/provider/signals',
  '/provider/strategies',
  '/provider/subscribers',
  '/provider/analytics',
];

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/strategies',
  '/providers',
  '/leaderboard',
  '/marketplace',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get authentication token from cookies (will be implemented with HttpOnly cookies)
  const accessToken = request.cookies.get('access_token');
  
  // Check if current route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isProviderRoute = providerRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // Allow public routes without authentication
  if (isPublicRoute && !isProtectedRoute) {
    return NextResponse.next();
  }

  // Protected routes - require authentication
  if (isProtectedRoute || isProviderRoute) {
    // No token - redirect to login
    if (!accessToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      
      // Add message parameter for user feedback
      url.searchParams.set('message', 'Bu sayfaya erişmek için giriş yapmanız gerekiyor.');
      
      return NextResponse.redirect(url);
    }

    // TODO: Implement token verification and role checking
    // For now, we allow access if token exists
    // In production, verify JWT token here:
    // 
    // try {
    //   const decoded = await verifyJWT(accessToken.value);
    //   
    //   // Check role for provider routes
    //   if (isProviderRoute && decoded.role !== 'provider') {
    //     const url = request.nextUrl.clone();
    //     url.pathname = '/unauthorized';
    //     return NextResponse.redirect(url);
    //   }
    // } catch (error) {
    //   // Invalid token - clear and redirect
    //   const url = request.nextUrl.clone();
    //   url.pathname = '/login';
    //   const response = NextResponse.redirect(url);
    //   response.cookies.delete('access_token');
    //   return response;
    // }
  }

  // Allow request to proceed
  return NextResponse.next();
}

// Configure which routes should run middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
