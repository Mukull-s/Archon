import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Spinner } from '../ui/DesignSystem';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard for signed-in-only pages.
 *
 *   hydrating  → a quiet paper holding state (not a dark splash)
 *   anonymous  → redirect to /auth, preserving where they were headed
 *   signed in  → children
 *
 * The holding state uses the same instrument-paper surface as the marketing
 * and auth pages, so a session check never flashes a differently-styled app.
 *
 * `Spinner` still carries the legacy dark-theme stroke, so it is tinted to the
 * paper palette locally rather than restyling the shared component (which the
 * dashboard still uses on its own dark surfaces).
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <span className="text-ink-3">
          <Spinner size="lg" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          Verifying session
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
