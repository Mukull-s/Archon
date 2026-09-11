import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Spinner } from '../components/ui/DesignSystem';

/**
 * Dashboard Index Route (/dashboard)
 * 
 * When a user visits /dashboard directly without a repository ID:
 * - Fetches user's scanned repositories.
 * - Redirects to their most recently accessed repository if available.
 * - Otherwise redirects to /history (Repository Hub) to scan or manage repos.
 */
export default function DashboardIndex() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveTarget() {
      try {
        const { data } = await api.get('/repos');
        const repos = data.data || [];
        if (!isMounted) return;

        if (Array.isArray(repos) && repos.length > 0) {
          navigate(`/dashboard/${repos[0].id}`, { replace: true });
        } else {
          navigate('/history', { replace: true });
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Failed to resolve repositories for dashboard:', err);
        setError('Could not load repositories. Please try visiting Repository Hub.');
      }
    }

    resolveTarget();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

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
      {error ? (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{error}</p>
          <button
            onClick={() => navigate('/history', { replace: true })}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: '13px', cursor: 'pointer' }}
          >
            Go to Repository Hub
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Spinner size="lg" />
          <span style={{ fontSize: '13px', color: '#71717a' }}>Opening workspace...</span>
        </div>
      )}
    </div>
  );
}
