/**
 * components/common/ProtectedRoute.tsx
 * Redirects unauthenticated users to /login.
 * Redirects users with mustChangePassword to /change-password before anything else.
 * Optionally restricts to a specific role.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

interface ProtectedRouteProps {
  requiredRole?: 'COUNSELOR' | 'ADMIN';
}

export const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Force password change before the user can access anything else
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};
