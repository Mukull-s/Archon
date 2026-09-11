import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Spinner } from '../ui/DesignSystem';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard component that requires authentication.
 * 
 * - If auth is still hydrating/loading: renders a sleek dark loading state.
 * - If unauthenticated: redirects to /auth preserving the destination in ?redirect=
 * - If authenticated: renders the protected children cleanly.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#09090b',
          color: '#a1a1aa',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <Spinner size="lg" />
        </div>
        <span style={{ fontSize: '13px', letterSpacing: '-0.01em', color: '#71717a' }}>
          Verifying session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  return <>{children}</>;
}
