import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

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
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '2.5px solid rgba(176, 38, 255, 0.15)',
            borderTopColor: '#b026ff',
            borderRadius: '50%',
            animation: 'archon-spin 0.8s linear infinite',
            marginBottom: '16px',
          }}
        />
        <span style={{ fontSize: '13px', letterSpacing: '-0.01em', color: '#71717a' }}>
          Verifying session...
        </span>
        <style>{`
          @keyframes archon-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  return <>{children}</>;
}
