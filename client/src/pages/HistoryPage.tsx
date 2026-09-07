import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import api from '../lib/api';

interface RepoSummary {
  id: string;
  name: string;
  owner: string | null;
  isLocal: boolean;
  framework: string | null;
  languages: string[];
  fileCount: number;
  totalSize: number;
  confidence: number;
  indexingStatus: string;
  createdAt: string;
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    api.get('/repos')
      .then(({ data }) => {
        setRepos(data.data || []);
      })
      .catch((err) => {
        console.error('Failed to load repositories:', err);
        setRepos([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredRepos = repos.filter((r) => {
    const q = searchQuery.toLowerCase();
    return r.name.toLowerCase().includes(q) || (r.owner && r.owner.toLowerCase().includes(q));
  });

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e1e5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1120px', margin: '0 auto', width: '100%', padding: '120px 24px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '6px' }}>
              My Repositories
            </h1>
            <p style={{ fontSize: '14px', color: '#919095' }}>
              Manage your scanned repositories, view architecture graphs, and explore codebase intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Scan Repository
            </button>
          </div>
        </div>

        {/* Search input */}
        {repos.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Search repositories by name or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '2px solid rgba(176, 38, 255, 0.15)',
                borderTopColor: '#b026ff',
                borderRadius: '50%',
                animation: 'archon-spin 0.8s linear infinite',
                marginBottom: '16px',
              }}
            />
            <span style={{ fontSize: '13px', color: '#71717a' }}>Loading repositories...</span>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '64px 24px',
              background: 'rgba(255,255,255,0.015)',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(176, 38, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: 'var(--accent, #b026ff)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              {searchQuery ? 'No matching repositories found' : 'No repositories indexed yet'}
            </h3>
            <p style={{ fontSize: '14px', color: '#71717a', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
              {searchQuery
                ? 'Try refining your search query or clear the filter.'
                : 'Scan your first GitHub repository or upload a ZIP file to inspect its architectural graph, dependency map, and AI summaries.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                Scan a Repository
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        background: repo.indexingStatus === 'completed'
                          ? 'rgba(34, 197, 94, 0.1)'
                          : repo.indexingStatus === 'indexing'
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                        color: repo.indexingStatus === 'completed'
                          ? '#4ade80'
                          : repo.indexingStatus === 'indexing'
                          ? '#60a5fa'
                          : '#f87171',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {repo.indexingStatus}
                    </span>
                    <span style={{ fontSize: '11px', color: '#71717a' }}>
                      {new Date(repo.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>
                    {repo.owner ? `${repo.owner}/${repo.name}` : repo.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: '#919095', marginBottom: '16px' }}>
                    {repo.framework || 'General Project'} • {repo.fileCount} files • {Math.round(repo.totalSize / 1024)} KB
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <Link
                    to={`/dashboard/${repo.id}`}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '7px 12px',
                      fontSize: '12px',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    Open Workspace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
