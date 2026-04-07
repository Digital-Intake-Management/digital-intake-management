/**
 * components/common/ProtectedRoute.tsx
 * Redirects unauthenticated users to /login.
 * Optionally restricts to a specific role.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';

interface ProtectedRouteProps {
  requiredRole?: 'COUNSELOR' | 'ADMIN';
}

export const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};
