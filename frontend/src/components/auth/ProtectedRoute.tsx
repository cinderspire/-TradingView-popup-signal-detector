'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Not authenticated - redirect to login
      if (!isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      // Authenticated but doesn't have required role
      if (requiredRole && user?.role !== requiredRole) {
        // Redirect to unauthorized page or dashboard
        router.push('/unauthorized');
      }
    }
  }, [isAuthenticated, isLoading, user, requiredRole, redirectTo, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - don't render content (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated but wrong role - don't render content (will redirect)
  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  // Authenticated and authorized - render content
  return <>{children}</>;
}
