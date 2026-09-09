import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  isArchived?: boolean;
  reindexCount?: number;
  createdAt: string;
}

type FilterType = 'all' | 'github' | 'local' | 'high-confidence';
type ViewMode = 'table' | 'cards';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
  // Deletion modal state
  const [repoToDelete, setRepoToDelete] = useState<RepoSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/repos');
      setRepos(data.data || []);
    } catch (err: any) {
      console.error('Failed to load repositories:', err);
      const errMsg = err.response?.data?.error?.message || 'Failed to connect to Codebase Registry. Please verify your connection.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchRepos();
  }, [fetchRepos]);

  // Keyboard accessibility: close delete modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && repoToDelete && !isDeleting) {
        setRepoToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [repoToDelete, isDeleting]);

  const handleDelete = async () => {
    if (!repoToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete(`/repos/${repoToDelete.id}`);
      toast.success(`Repository "${repoToDelete.name}" purged from registry.`);
      setRepos((prev) => prev.filter((r) => r.id !== repoToDelete.id));
      setRepoToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete repository:', err);
      const errMsg = err.response?.data?.error?.message || 'Failed to purge repository. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async (repoId: string, repoName: string) => {
    try {
      await api.post(`/repos/${repoId}/archive`);
      toast.success(`Repository "${repoName}" archived. Active slot freed.`);
      fetchRepos();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Failed to archive repository.';
      toast.error(errMsg);
    }
  };

  const handleUnarchive = async (repoId: string, repoName: string) => {
    try {
      await api.post(`/repos/${repoId}/unarchive`);
      toast.success(`Repository "${repoName}" activated.`);
      fetchRepos();
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || 'Active limit reached. Archive other repos or upgrade to Pro.';
      toast.error(errMsg);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Telemetry aggregates
  const telemetry = useMemo(() => {
    const totalCount = repos.length;
    const activeCount = repos.filter((r) => !r.isArchived).length;
    const archivedCount = repos.filter((r) => r.isArchived).length;
    const totalFiles = repos.reduce((acc, r) => acc + (r.fileCount || 0), 0);
    const totalBytes = repos.reduce((acc, r) => acc + (r.totalSize || 0), 0);
    const validConf = repos.filter((r) => r.confidence > 0);
    const avgConfidence = validConf.length > 0
      ? Math.round(validConf.reduce((acc, r) => acc + r.confidence, 0) / validConf.length)
      : 0;

    return {
      totalCount,
      activeCount,
      archivedCount,
      totalFiles,
      totalSize: formatSize(totalBytes),
      avgConfidence,
    };
  }, [repos]);

  // Filtered & Searched repos
  const filteredRepos = useMemo(() => {
    return repos.filter((r) => {
      // 1. Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesOwner = r.owner ? r.owner.toLowerCase().includes(q) : false;
        const matchesFramework = r.framework ? r.framework.toLowerCase().includes(q) : false;
        const matchesLang = Array.isArray(r.languages) && r.languages.some((l) => l.toLowerCase().includes(q));
        if (!matchesName && !matchesOwner && !matchesFramework && !matchesLang) {
          return false;
        }
      }

      // 2. Type filter
      if (activeFilter === 'github') return !r.isLocal;
      if (activeFilter === 'local') return r.isLocal;
      if (activeFilter === 'high-confidence') return r.confidence >= 80;

      return true;
    });
  }, [repos, searchQuery, activeFilter]);

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e1e5', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans, system-ui)' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '110px 24px 70px' }}>
        {/* Top Header & Command Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '100px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '12px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a1a1aa' }}>
                Codebase Registry
              </span>
            </div>
            <h1 style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.03em', color: '#ffffff', margin: '0 0 8px 0', lineHeight: 1.2 }}>
              Repositories & Workspaces
            </h1>
            <p style={{ fontSize: '14px', color: '#71717a', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
              Centralized intelligence index of parsed repositories, AST dependency models, and live architecture workspaces.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
              style={{
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Index New Codebase</span>
            </button>
          </div>
        </div>

        {/* Telemetry Overview Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
              Active Codebases
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                {telemetry.activeCount}
              </span>
              <span style={{ fontSize: '12px', color: '#71717a' }}>
                active ({telemetry.archivedCount} archived)
              </span>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
              Indexed Files
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                {telemetry.totalFiles.toLocaleString()}
              </span>
              <span style={{ fontSize: '12px', color: '#71717a' }}>AST nodes</span>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
              Registry Volume
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                {telemetry.totalSize}
              </span>
              <span style={{ fontSize: '12px', color: '#71717a' }}>source payload</span>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
              Mean Graph Health
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: telemetry.avgConfidence >= 80 ? '#4ade80' : '#facc15', fontFamily: 'var(--font-mono, monospace)' }}>
                {telemetry.avgConfidence > 0 ? `${telemetry.avgConfidence}%` : 'N/A'}
              </span>
              <span style={{ fontSize: '12px', color: '#71717a' }}>confidence</span>
            </div>
          </div>
        </div>

        {/* Command Control Bar: Search + Filter Pills + View Switcher */}
        <div
          style={{
            background: 'rgba(18, 18, 22, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
            <input
              type="text"
              placeholder="Filter by repository name, framework, or language..."
              aria-label="Filter repositories by name, framework, or language"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 38px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-sans, system-ui)',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(168, 85, 247, 0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
            />
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#71717a"
              strokeWidth="2"
              aria-hidden="true"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search input"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#919095',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeFilter === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                background: activeFilter === 'all' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                color: activeFilter === 'all' ? '#fff' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              All Codebases ({repos.length})
            </button>
            <button
              onClick={() => setActiveFilter('github')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeFilter === 'github' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                background: activeFilter === 'github' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                color: activeFilter === 'github' ? '#fff' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub Sync
            </button>
            <button
              onClick={() => setActiveFilter('local')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeFilter === 'local' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                background: activeFilter === 'local' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                color: activeFilter === 'local' ? '#fff' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Local ZIPs
            </button>
            <button
              onClick={() => setActiveFilter('high-confidence')}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid',
                borderColor: activeFilter === 'high-confidence' ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.06)',
                background: activeFilter === 'high-confidence' ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                color: activeFilter === 'high-confidence' ? '#4ade80' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              High Confidence (≥80%)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div role="group" aria-label="Layout view selector" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <button
              onClick={() => setViewMode('table')}
              aria-label="Switch to table view"
              aria-pressed={viewMode === 'table'}
              style={{
                padding: '5px 9px',
                background: viewMode === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: viewMode === 'table' ? '#fff' : '#71717a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              aria-label="Switch to card view"
              aria-pressed={viewMode === 'cards'}
              style={{
                padding: '5px 9px',
                background: viewMode === 'cards' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: viewMode === 'cards' ? '#fff' : '#71717a',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Cards</span>
            </button>
          </div>
        </div>

        {/* Dynamic Content: Loading / Error / Empty / Table / Cards */}
        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '90px 0',
              background: 'rgba(255, 255, 255, 0.01)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                border: '2px solid rgba(255, 255, 255, 0.1)',
                borderTopColor: '#a855f7',
                borderRadius: '50%',
                animation: 'archon-spin 0.8s linear infinite',
                marginBottom: '16px',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#a1a1aa' }}>Querying Codebase Registry...</span>
            <span style={{ fontSize: '11px', color: '#52525b', marginTop: '4px' }}>Loading AST graph models and repository summaries</span>
          </div>
        ) : error ? (
          /* Error State */
          <div
            style={{
              textAlign: 'center',
              padding: '50px 24px',
              background: 'rgba(239, 68, 68, 0.03)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#f87171',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              Registry Connection Failed
            </h3>
            <p style={{ fontSize: '13px', color: '#a1a1aa', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              {error}
            </p>
            <button
              onClick={fetchRepos}
              className="btn-primary"
              style={{ padding: '8px 20px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}
            >
              Retry Connection
            </button>
          </div>
        ) : filteredRepos.length === 0 ? (
          /* Empty State */
          <div
            style={{
              textAlign: 'center',
              padding: '72px 24px',
              background: 'rgba(255, 255, 255, 0.015)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                color: '#a1a1aa',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <circle cx="12" cy="9" r="2" />
                <path d="M12 11v4" />
              </svg>
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
              {searchQuery || activeFilter !== 'all' ? 'No matching codebases found' : 'No Codebases Indexed Yet'}
            </h3>
            <p style={{ fontSize: '13px', color: '#71717a', maxWidth: '460px', margin: '0 auto 24px', lineHeight: 1.5 }}>
              {searchQuery || activeFilter !== 'all'
                ? 'No repositories in your registry match the active criteria. Try broadening your search or resetting filters.'
                : 'Archon indexes your codebase into high-fidelity AST dependency graphs, architectural blast-radius traces, and cognitive reasoning maps.'}
            </p>

            {searchQuery || activeFilter !== 'all' ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
                className="btn-secondary"
                style={{ padding: '7px 18px', fontSize: '13px', cursor: 'pointer', borderRadius: '6px' }}
              >
                Reset All Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/')}
                className="btn-primary"
                style={{ padding: '9px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '6px' }}
              >
                Index Your First Codebase
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ========================================================================= */
          /* TABLE VIEW: Dense, startup command-center registry                        */
          /* ========================================================================= */
          <div
            style={{
              background: 'rgba(18, 18, 22, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              overflow: 'hidden',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '860px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <th scope="col" style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
                      Repository & Source
                    </th>
                    <th scope="col" style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
                      Architecture
                    </th>
                    <th scope="col" style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
                      AST Health
                    </th>
                    <th scope="col" style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
                      Footprint
                    </th>
                    <th scope="col" style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a' }}>
                      Indexed
                    </th>
                    <th scope="col" style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71717a', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRepos.map((repo, idx) => (
                    <tr
                      key={repo.id}
                      style={{
                        borderBottom: idx === filteredRepos.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s ease',
                      }}
                      className="registry-row"
                    >
                      {/* Repo & Source */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#d4d4d8',
                              flexShrink: 0,
                            }}
                          >
                            {repo.isLocal ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                              </svg>
                            )}
                          </div>

                          <div>
                            <Link
                              to={`/dashboard/${repo.id}`}
                              style={{
                                color: '#ffffff',
                                fontSize: '13px',
                                fontWeight: 600,
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'color 0.15s',
                              }}
                              className="repo-title-link"
                            >
                              <span>{repo.owner ? `${repo.owner}/${repo.name}` : repo.name}</span>
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '100px',
                                  fontWeight: 600,
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                  background:
                                    repo.indexingStatus === 'completed'
                                      ? 'rgba(34, 197, 94, 0.1)'
                                      : repo.indexingStatus === 'indexing'
                                      ? 'rgba(56, 189, 248, 0.1)'
                                      : 'rgba(239, 68, 68, 0.1)',
                                  color:
                                    repo.indexingStatus === 'completed'
                                      ? '#4ade80'
                                      : repo.indexingStatus === 'indexing'
                                      ? '#38bdf8'
                                      : '#f87171',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span
                                  style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background:
                                      repo.indexingStatus === 'completed'
                                        ? '#22c55e'
                                        : repo.indexingStatus === 'indexing'
                                        ? '#38bdf8'
                                        : '#ef4444',
                                  }}
                                />
                                {repo.indexingStatus === 'completed' ? 'Indexed' : repo.indexingStatus}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '100px',
                                  fontWeight: 600,
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                  background: repo.isArchived ? 'rgba(255, 255, 255, 0.05)' : 'rgba(168, 85, 247, 0.1)',
                                  color: repo.isArchived ? '#71717a' : '#c084fc',
                                  border: repo.isArchived ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(168, 85, 247, 0.3)',
                                }}
                              >
                                {repo.isArchived ? 'Archived' : 'Active'}
                              </span>
                              <span style={{ fontSize: '11px', color: '#71717a', fontFamily: 'var(--font-mono, monospace)' }}>
                                {repo.isLocal ? 'local-zip' : 'github'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Architecture */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#d4d4d8' }}>
                            {repo.framework || 'General Project'}
                          </span>
                          {Array.isArray(repo.languages) && repo.languages.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {repo.languages.slice(0, 3).map((lang) => (
                                <span
                                  key={lang}
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    color: '#a1a1aa',
                                    fontFamily: 'var(--font-mono, monospace)',
                                  }}
                                >
                                  {lang}
                                </span>
                              ))}
                              {repo.languages.length > 3 && (
                                <span style={{ fontSize: '10px', color: '#71717a' }}>
                                  +{repo.languages.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* AST Health */}
                      <td style={{ padding: '14px 16px' }}>
                        {repo.confidence > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '44px',
                                height: '4px',
                                borderRadius: '100px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${repo.confidence}%`,
                                  height: '100%',
                                  background: repo.confidence >= 80 ? '#22c55e' : '#eab308',
                                  borderRadius: '100px',
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                fontFamily: 'var(--font-mono, monospace)',
                                color: repo.confidence >= 80 ? '#4ade80' : '#facc15',
                              }}
                            >
                              {repo.confidence}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#71717a', fontFamily: 'var(--font-mono, monospace)' }}>
                            –
                          </span>
                        )}
                      </td>

                      {/* Footprint */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'var(--font-mono, monospace)' }}>
                          <span style={{ fontSize: '12px', color: '#e4e4e7' }}>
                            {repo.fileCount.toLocaleString()} files
                          </span>
                          <span style={{ fontSize: '11px', color: '#71717a' }}>
                            {formatSize(repo.totalSize)}
                          </span>
                        </div>
                      </td>

                      {/* Indexed At */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '12px', color: '#71717a', whiteSpace: 'nowrap' }}>
                          {formatRelativeTime(repo.createdAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                          <Link
                            to={`/dashboard/${repo.id}`}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s',
                            }}
                            className="launch-btn"
                          >
                            <span>Launch</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>

                          <button
                            onClick={() => repo.isArchived ? handleUnarchive(repo.id, repo.name) : handleArchive(repo.id, repo.name)}
                            title={repo.isArchived ? `Activate ${repo.name} (uses 1 active slot)` : `Archive ${repo.name} (frees 1 active slot)`}
                            aria-label={repo.isArchived ? `Activate repository ${repo.name}` : `Archive repository ${repo.name}`}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: repo.isArchived ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                              border: repo.isArchived ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                              color: repo.isArchived ? '#c084fc' : '#a1a1aa',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s',
                            }}
                          >
                            {repo.isArchived ? 'Activate' : 'Archive'}
                          </button>

                          <button
                            onClick={() => setRepoToDelete(repo)}
                            title={`Purge ${repo.name} from registry`}
                            aria-label={`Delete repository ${repo.name}`}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '6px',
                              color: '#71717a',
                              padding: '5px 8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                              e.currentTarget.style.color = '#f87171';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                              e.currentTarget.style.color = '#71717a';
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* CARDS VIEW: Modern telemetry architecture cards                           */
          /* ========================================================================= */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                style={{
                  background: 'rgba(18, 18, 22, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  backdropFilter: 'blur(16px)',
                }}
                className="registry-card"
              >
                <div>
                  {/* Top Bar: Source badge + Status pill + timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: '#e4e4e7',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        {repo.isLocal ? (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            ZIP
                          </>
                        ) : (
                          <>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                            </svg>
                            GitHub
                          </>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          background:
                            repo.indexingStatus === 'completed'
                              ? 'rgba(34, 197, 94, 0.1)'
                              : 'rgba(56, 189, 248, 0.1)',
                          color:
                            repo.indexingStatus === 'completed'
                              ? '#4ade80'
                              : '#38bdf8',
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {repo.indexingStatus === 'completed' ? 'Indexed' : repo.indexingStatus}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          background: repo.isArchived ? 'rgba(255, 255, 255, 0.05)' : 'rgba(168, 85, 247, 0.1)',
                          color: repo.isArchived ? '#71717a' : '#c084fc',
                          border: repo.isArchived ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(168, 85, 247, 0.3)',
                          fontWeight: 600,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {repo.isArchived ? 'Archived' : 'Active'}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: '#71717a' }}>
                      {formatRelativeTime(repo.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '6px', wordBreak: 'break-word' }}>
                    <Link
                      to={`/dashboard/${repo.id}`}
                      style={{ color: '#fff', textDecoration: 'none' }}
                      className="repo-title-link"
                    >
                      {repo.owner ? `${repo.owner}/${repo.name}` : repo.name}
                    </Link>
                  </h3>

                  {/* Framework & Language Chips */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#d4d4d8' }}>
                      {repo.framework || 'General Project'}
                    </span>
                    {Array.isArray(repo.languages) && repo.languages.length > 0 && (
                      <>
                        <span style={{ color: '#52525b' }}>•</span>
                        {repo.languages.slice(0, 3).map((lang) => (
                          <span
                            key={lang}
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.04)',
                              color: '#a1a1aa',
                              fontFamily: 'var(--font-mono, monospace)',
                            }}
                          >
                            {lang}
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Metric Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      padding: '10px',
                      marginBottom: '18px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', display: 'block' }}>Files</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                        {repo.fileCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', display: 'block' }}>Payload</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
                        {formatSize(repo.totalSize)}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#71717a', textTransform: 'uppercase', display: 'block' }}>Confidence</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: repo.confidence >= 80 ? '#4ade80' : '#facc15', fontFamily: 'var(--font-mono, monospace)' }}>
                        {repo.confidence > 0 ? `${repo.confidence}%` : '–'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <Link
                    to={`/dashboard/${repo.id}`}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      borderRadius: '6px',
                    }}
                  >
                    <span>Launch Workspace</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>

                  <button
                    onClick={() => repo.isArchived ? handleUnarchive(repo.id, repo.name) : handleArchive(repo.id, repo.name)}
                    title={repo.isArchived ? `Activate ${repo.name} (uses 1 active slot)` : `Archive ${repo.name} (frees 1 active slot)`}
                    aria-label={repo.isArchived ? `Activate repository ${repo.name}` : `Archive repository ${repo.name}`}
                    style={{
                      background: repo.isArchived ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                      border: repo.isArchived ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      color: repo.isArchived ? '#c084fc' : '#a1a1aa',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {repo.isArchived ? 'Activate' : 'Archive'}
                  </button>

                  <button
                    onClick={() => setRepoToDelete(repo)}
                    aria-label={`Delete repository ${repo.name}`}
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      color: '#f87171',
                      padding: '7px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Delete repository ${repo.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modal for Permanent Codebase Purge */}
      {repoToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="purge-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setRepoToDelete(null);
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: '#121118',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
              color: '#fff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 id="purge-dialog-title" style={{ fontSize: '17px', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                  Purge Codebase from Registry
                </h3>
                <span style={{ fontSize: '12px', color: '#71717a' }}>Irreversible architectural model removal</span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.55, marginBottom: '22px' }}>
              Are you sure you want to permanently purge <strong style={{ color: '#fff' }}>{repoToDelete.owner ? `${repoToDelete.owner}/${repoToDelete.name}` : repoToDelete.name}</strong>?
              All indexed AST dependency nodes, vector embeddings, and workspace traces will be completely erased.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setRepoToDelete(null)}
                style={{
                  padding: '8px 15px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#e4e4e7',
                  fontSize: '13px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#dc2626',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  fontSize: '13px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isDeleting ? (
                  <>
                    <div
                      style={{
                        width: '13px',
                        height: '13px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'archon-spin 0.8s linear infinite',
                      }}
                    />
                    <span>Purging...</span>
                  </>
                ) : (
                  <span>Purge Codebase</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      <style>{`
        @keyframes archon-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .registry-row:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .registry-card:hover {
          border-color: rgba(255, 255, 255, 0.12) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .repo-title-link:hover {
          color: #c15cff !important;
        }
        .launch-btn:hover {
          background: rgba(168, 85, 247, 0.15) !important;
          border-color: rgba(168, 85, 247, 0.4) !important;
        }
      `}</style>
    </div>
  );
}
