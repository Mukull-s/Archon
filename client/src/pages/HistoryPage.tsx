import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import api from '../lib/api';
import { Button, Badge, Input, Modal, Spinner } from '../components/ui/DesignSystem';

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
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-28 pb-16">
        {/* Top Header & Command Title */}
        <div className="flex items-start justify-between flex-wrap gap-5 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-elevated border border-border-subtle mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Codebase Registry
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2 leading-tight">
              Repositories & Workspaces
            </h1>
            <p className="text-sm text-text-muted max-w-2xl leading-relaxed m-0">
              Centralized intelligence index of parsed repositories, AST dependency models, and live architecture workspaces.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/')}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Index New Codebase
            </Button>
          </div>
        </div>

        {/* Telemetry Overview Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
          <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Active Codebases
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">
                {telemetry.activeCount}
              </span>
              <span className="text-xs text-text-muted">
                active ({telemetry.archivedCount} archived)
              </span>
            </div>
          </div>

          <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Indexed Files
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">
                {telemetry.totalFiles.toLocaleString()}
              </span>
              <span className="text-xs text-text-muted">AST nodes</span>
            </div>
          </div>

          <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Registry Volume
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary font-mono">
                {telemetry.totalSize}
              </span>
              <span className="text-xs text-text-muted">source payload</span>
            </div>
          </div>

          <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-4 sm:p-5 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Mean Graph Health
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold font-mono ${
                  telemetry.avgConfidence >= 80 ? 'text-status-success' : 'text-status-warning'
                }`}
              >
                {telemetry.avgConfidence > 0 ? `${telemetry.avgConfidence}%` : 'N/A'}
              </span>
              <span className="text-xs text-text-muted">confidence</span>
            </div>
          </div>
        </div>

        {/* Command Control Bar: Search + Filter Pills + View Switcher */}
        <div className="bg-surface-base/70 border border-border-subtle rounded-xl p-3 sm:px-4 mb-6 flex items-center justify-between flex-wrap gap-3.5 backdrop-blur-md shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px] max-w-[420px]">
            <Input
              type="text"
              placeholder="Filter by repository name, framework, or language..."
              aria-label="Filter repositories by name, framework, or language"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              }
              rightIcon={
                searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search input"
                    className="text-text-muted hover:text-text-primary text-xs p-1 cursor-pointer transition-colors"
                  >
                    ✕
                  </button>
                ) : undefined
              }
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-surface-elevated text-text-primary border-border-default shadow-xs'
                  : 'bg-surface-base/40 text-text-muted hover:text-text-primary border-border-subtle/60'
              }`}
            >
              All Codebases ({repos.length})
            </button>
            <button
              onClick={() => setActiveFilter('github')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                activeFilter === 'github'
                  ? 'bg-surface-elevated text-text-primary border-border-default shadow-xs'
                  : 'bg-surface-base/40 text-text-muted hover:text-text-primary border-border-subtle/60'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub Sync
            </button>
            <button
              onClick={() => setActiveFilter('local')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                activeFilter === 'local'
                  ? 'bg-surface-elevated text-text-primary border-border-default shadow-xs'
                  : 'bg-surface-base/40 text-text-muted hover:text-text-primary border-border-subtle/60'
              }`}
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
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all cursor-pointer ${
                activeFilter === 'high-confidence'
                  ? 'bg-status-success/15 text-status-success border-status-success/30 shadow-xs'
                  : 'bg-surface-base/40 text-text-muted hover:text-text-primary border-border-subtle/60'
              }`}
            >
              High Confidence (≥80%)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div role="group" aria-label="Layout view selector" className="flex items-center bg-surface-base/60 rounded-lg p-1 border border-border-subtle">
            <button
              onClick={() => setViewMode('table')}
              aria-label="Switch to table view"
              aria-pressed={viewMode === 'table'}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-surface-elevated text-text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary bg-transparent'
              }`}
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
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-surface-elevated text-text-primary shadow-xs'
                  : 'text-text-muted hover:text-text-primary bg-transparent'
              }`}
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
          <div className="flex flex-col items-center justify-center py-20 bg-surface-base/40 rounded-xl border border-border-subtle/50 text-center">
            <Spinner size="lg" className="mb-4 text-accent" />
            <span className="text-[13px] font-medium text-text-secondary">Querying Codebase Registry...</span>
            <span className="text-[11px] text-text-muted mt-1">Loading AST graph models and repository summaries</span>
          </div>
        ) : error ? (
          /* Error State */
          <div className="text-center p-8 sm:p-12 bg-status-error/5 border border-status-error/20 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-status-error/10 flex items-center justify-center mx-auto mb-4 text-status-error">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-[17px] font-semibold text-text-primary mb-2">
              Registry Connection Failed
            </h3>
            <p className="text-[13px] text-text-muted max-w-md mx-auto mb-5 leading-relaxed">
              {error}
            </p>
            <Button variant="secondary" size="md" onClick={fetchRepos}>
              Retry Connection
            </Button>
          </div>
        ) : filteredRepos.length === 0 ? (
          /* Empty State */
          <div className="text-center p-12 sm:p-16 bg-surface-base/30 border border-dashed border-border-default rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center mx-auto mb-4 text-text-muted">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <circle cx="12" cy="9" r="2" />
                <path d="M12 11v4" />
              </svg>
            </div>

            <h3 className="text-[17px] font-semibold text-text-primary mb-2">
              {searchQuery || activeFilter !== 'all' ? 'No matching codebases found' : 'No Codebases Indexed Yet'}
            </h3>
            <p className="text-[13px] text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
              {searchQuery || activeFilter !== 'all'
                ? 'No repositories in your registry match the active criteria. Try broadening your search or resetting filters.'
                : 'Archon indexes your codebase into high-fidelity AST dependency graphs, architectural blast-radius traces, and cognitive reasoning maps.'}
            </p>

            {searchQuery || activeFilter !== 'all' ? (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
              >
                Reset All Filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/')}
              >
                Index Your First Codebase
              </Button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* ========================================================================= */
          /* TABLE VIEW: Dense, startup command-center registry                        */
          /* ========================================================================= */
          <div className="bg-surface-base/50 border border-border-subtle rounded-xl overflow-hidden backdrop-blur-md shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[860px]">
                <thead>
                  <tr className="border-b border-border-subtle bg-surface-base/60">
                    <th scope="col" className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Repository & Source
                    </th>
                    <th scope="col" className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Architecture
                    </th>
                    <th scope="col" className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      AST Health
                    </th>
                    <th scope="col" className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Footprint
                    </th>
                    <th scope="col" className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Indexed
                    </th>
                    <th scope="col" className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredRepos.map((repo) => (
                    <tr
                      key={repo.id}
                      className="hover:bg-surface-elevated/40 transition-colors duration-150"
                    >
                      {/* Repo & Source */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-md bg-surface-elevated border border-border-subtle flex items-center justify-center text-text-secondary flex-shrink-0">
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
                              className="text-text-primary hover:text-accent text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors no-underline"
                            >
                              <span>{repo.owner ? `${repo.owner}/${repo.name}` : repo.name}</span>
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={
                                  repo.indexingStatus === 'completed'
                                    ? 'success'
                                    : repo.indexingStatus === 'indexing'
                                    ? 'info'
                                    : 'danger'
                                }
                                showDot
                              >
                                {repo.indexingStatus === 'completed' ? 'Indexed' : repo.indexingStatus}
                              </Badge>
                              <Badge variant={repo.isArchived ? 'neutral' : 'purple'}>
                                {repo.isArchived ? 'Archived' : 'Active'}
                              </Badge>
                              <span className="text-[11px] text-text-muted font-mono">
                                {repo.isLocal ? 'local-zip' : 'github'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Architecture */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-text-secondary">
                            {repo.framework || 'General Project'}
                          </span>
                          {Array.isArray(repo.languages) && repo.languages.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {repo.languages.slice(0, 3).map((lang) => (
                                <span
                                  key={lang}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted font-mono"
                                >
                                  {lang}
                                </span>
                              ))}
                              {repo.languages.length > 3 && (
                                <span className="text-[10px] text-text-muted">
                                  +{repo.languages.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* AST Health */}
                      <td className="py-3.5 px-4">
                        {repo.confidence > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-11 h-1 rounded-full bg-surface-elevated overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  repo.confidence >= 80 ? 'bg-status-success' : 'bg-status-warning'
                                }`}
                                style={{ width: `${repo.confidence}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-semibold font-mono ${
                                repo.confidence >= 80 ? 'text-status-success' : 'text-status-warning'
                              }`}
                            >
                              {repo.confidence}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted font-mono">–</span>
                        )}
                      </td>

                      {/* Footprint */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5 font-mono">
                          <span className="text-xs text-text-primary">
                            {repo.fileCount.toLocaleString()} files
                          </span>
                          <span className="text-[11px] text-text-muted">
                            {formatSize(repo.totalSize)}
                          </span>
                        </div>
                      </td>

                      {/* Indexed At */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-text-muted whitespace-nowrap">
                          {formatRelativeTime(repo.createdAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <Link
                            to={`/dashboard/${repo.id}`}
                            className="px-3 py-1.5 rounded-md bg-white/[0.05] hover:bg-white/[0.1] border border-border-subtle hover:border-border-default text-text-primary text-xs font-medium inline-flex items-center gap-1.5 transition-colors no-underline"
                          >
                            <span>Launch</span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => repo.isArchived ? handleUnarchive(repo.id, repo.name) : handleArchive(repo.id, repo.name)}
                            title={repo.isArchived ? `Activate ${repo.name} (uses 1 active slot)` : `Archive ${repo.name} (frees 1 active slot)`}
                            aria-label={repo.isArchived ? `Activate repository ${repo.name}` : `Archive repository ${repo.name}`}
                            className={repo.isArchived ? 'text-accent hover:text-accent-hover' : 'text-text-muted hover:text-text-primary'}
                          >
                            {repo.isArchived ? 'Activate' : 'Archive'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRepoToDelete(repo)}
                            title={`Purge ${repo.name} from registry`}
                            aria-label={`Delete repository ${repo.name}`}
                            className="text-text-muted hover:text-status-error hover:bg-status-error/10"
                            icon={
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            }
                          />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className="bg-surface-base/50 hover:bg-surface-base/80 border border-border-subtle hover:border-border-default rounded-xl p-5 flex flex-col justify-between transition-all duration-200 backdrop-blur-md shadow-sm hover:shadow-md hover:-translate-y-0.5"
              >
                <div>
                  {/* Top Bar: Source badge + Status pill + timestamp */}
                  <div className="flex items-center justify-between mb-3.5 gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-border-subtle text-text-primary inline-flex items-center gap-1.5">
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
                      <Badge
                        variant={
                          repo.indexingStatus === 'completed'
                            ? 'success'
                            : repo.indexingStatus === 'indexing'
                            ? 'info'
                            : 'danger'
                        }
                        showDot
                      >
                        {repo.indexingStatus === 'completed' ? 'Indexed' : repo.indexingStatus}
                      </Badge>
                      <Badge variant={repo.isArchived ? 'neutral' : 'purple'}>
                        {repo.isArchived ? 'Archived' : 'Active'}
                      </Badge>
                    </div>

                    <span className="text-[11px] text-text-muted">
                      {formatRelativeTime(repo.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-[15px] font-semibold text-text-primary mb-1.5 break-words">
                    <Link
                      to={`/dashboard/${repo.id}`}
                      className="text-text-primary hover:text-accent transition-colors no-underline"
                    >
                      {repo.owner ? `${repo.owner}/${repo.name}` : repo.name}
                    </Link>
                  </h3>

                  {/* Framework & Language Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    <span className="text-xs font-medium text-text-secondary">
                      {repo.framework || 'General Project'}
                    </span>
                    {Array.isArray(repo.languages) && repo.languages.length > 0 && (
                      <>
                        <span className="text-text-muted">•</span>
                        {repo.languages.slice(0, 3).map((lang) => (
                          <span
                            key={lang}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted font-mono"
                          >
                            {lang}
                          </span>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Metric Strip */}
                  <div className="grid grid-cols-3 gap-2 bg-surface-base/40 border border-border-subtle/50 rounded-lg p-2.5 mb-4">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Files</span>
                      <span className="text-[13px] font-semibold text-text-primary font-mono">
                        {repo.fileCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Payload</span>
                      <span className="text-[13px] font-semibold text-text-primary font-mono">
                        {formatSize(repo.totalSize)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block">Confidence</span>
                      <span
                        className={`text-[13px] font-semibold font-mono ${
                          repo.confidence >= 80 ? 'text-status-success' : 'text-status-warning'
                        }`}
                      >
                        {repo.confidence > 0 ? `${repo.confidence}%` : '–'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3.5 border-t border-border-subtle/50">
                  <Link
                    to={`/dashboard/${repo.id}`}
                    className="flex-1 text-center py-2 px-3 text-xs font-semibold rounded-md bg-accent hover:bg-accent-hover text-white inline-flex items-center justify-center gap-1.5 transition-colors no-underline shadow-xs"
                  >
                    <span>Launch Workspace</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => repo.isArchived ? handleUnarchive(repo.id, repo.name) : handleArchive(repo.id, repo.name)}
                    title={repo.isArchived ? `Activate ${repo.name} (uses 1 active slot)` : `Archive ${repo.name} (frees 1 active slot)`}
                    aria-label={repo.isArchived ? `Activate repository ${repo.name}` : `Archive repository ${repo.name}`}
                    className={repo.isArchived ? 'text-accent hover:text-accent-hover' : 'text-text-muted hover:text-text-primary'}
                  >
                    {repo.isArchived ? 'Activate' : 'Archive'}
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRepoToDelete(repo)}
                    aria-label={`Delete repository ${repo.name}`}
                    title={`Delete repository ${repo.name}`}
                    icon={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modal for Permanent Codebase Purge */}
      <Modal
        isOpen={Boolean(repoToDelete)}
        onClose={() => !isDeleting && setRepoToDelete(null)}
        title="Purge Codebase from Registry"
        description="Irreversible architectural model removal"
        maxWidth="md"
      >
        {repoToDelete && (
          <div className="space-y-4 pt-1">
            <p className="text-[13px] text-text-muted leading-relaxed m-0">
              Are you sure you want to permanently purge{' '}
              <strong className="text-text-primary font-semibold">
                {repoToDelete.owner ? `${repoToDelete.owner}/${repoToDelete.name}` : repoToDelete.name}
              </strong>
              ? All indexed AST dependency nodes, vector embeddings, and workspace traces will be completely erased.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={isDeleting}
                onClick={() => setRepoToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                disabled={isDeleting}
                isLoading={isDeleting}
                onClick={handleDelete}
              >
                Purge Codebase
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Footer />
    </div>
  );
}
