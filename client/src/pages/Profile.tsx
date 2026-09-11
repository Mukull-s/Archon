import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Button, Card, Badge, FormField, Input, Modal, Spinner } from '../components/ui/DesignSystem';

interface Repo {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  status: string;
  isArchived?: boolean;
  fileCount?: number;
  createdAt: string;
}

interface UsageData {
  plan: 'free' | 'pro';
  limits: {
    name: string;
    displayName: string;
    priceMonthly: number;
    period: string;
    tagline: string;
    lifetimeAnalyses: number;
    maxActiveCodebases: number;
    maxFilesPerRepo: number;
    maxRepoSizeBytes: number;
    monthlyAiQuestions: number;
    monthlyReindexes: number;
    basicArchitecture: boolean;
    dependencyGraph: boolean;
    traceFlow: boolean;
    onboarding: boolean;
    basicRag: boolean;
    advancedAnalysis: boolean;
    fullHistory: boolean;
    priorityIndexing: boolean;
  };
  usage: {
    lifetimeAnalysesUsed: number;
    activeCodebases: number;
    totalCodebases: number;
    monthlyAiQuestionsUsed: number;
    monthlyReindexesUsed: number;
    usagePeriodStart: string;
  };
}

type TabType = 'entitlements' | 'codebases' | 'account';

export default function ProfilePage() {
  const { user, logout, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('entitlements');

  // Usage telemetry state
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Repositories state
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);

  // Profile edit state
  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const fetchUsageMetrics = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const { data } = await api.get('/auth/usage');
      if (data.success && data.data) {
        setUsageData(data.data);
      }
    } catch (err) {
      console.error('Failed to load usage metrics:', err);
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    setReposLoading(true);
    try {
      const { data } = await api.get('/repos');
      const list = Array.isArray(data.data?.repos)
        ? data.data.repos
        : Array.isArray(data.data)
        ? data.data
        : [];
      setRepos(list);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!user) {
      navigate('/auth');
      return;
    }
    setName(user.name || '');
    fetchUsageMetrics();
    fetchRepositories();
  }, [user, navigate, fetchUsageMetrics, fetchRepositories]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setProfileSaving(true);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      await fetchUser();
      toast.success('Profile updated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleUpgradeToArchitect = async () => {
    setUpgrading(true);
    try {
      await api.post('/auth/upgrade', { plan: 'pro' });
      await fetchUser();
      await fetchUsageMetrics();
      toast.success('Welcome to Archon Architect! 10 active codebases and 500 AI questions/mo unlocked.');
      setShowUpgradeModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to upgrade plan.');
    } finally {
      setUpgrading(false);
    }
  };

  const isArchitect = usageData?.plan === 'pro' || user?.plan === 'pro';
  const tierDisplayName = isArchitect ? 'Architect' : 'Explorer';

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const providerName = user?.provider === 'github' ? 'GitHub' : user?.provider === 'google' ? 'Google' : 'Email Auth';

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[1080px] mx-auto w-full px-6 pt-[120px] pb-[70px]">

        {/* ── COMMAND HEADER ── */}
        <section className="relative overflow-hidden rounded-[20px] p-7 sm:p-9 mb-8 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.4)] bg-[radial-gradient(ellipse_70%_50%_at_50%_-20%,rgba(176,38,255,0.12)_0%,rgba(15,12,23,0.6)_100%)]">
          {/* Subtle top edge glow */}
          <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-[#b026ff]/60 to-transparent pointer-events-none" />

          <div className="flex items-center justify-between flex-wrap gap-6">
            {/* Identity badge */}
            <div className="flex items-center gap-5">
              <div
                className={`w-[74px] h-[74px] rounded-[18px] border-2 border-[#b026ff]/40 shadow-[0_0_24px_rgba(176,38,255,0.25)] flex items-center justify-center overflow-hidden shrink-0 text-[28px] font-extrabold text-white ${
                  user?.avatarUrl ? 'bg-transparent' : 'bg-gradient-to-br from-[#b026ff] to-[#6366f1]'
                }`}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-white m-0">
                    {user?.name || user?.email?.split('@')[0] || 'Developer'}
                  </h1>

                  {/* Tier pill */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[0.08em] uppercase ${
                      isArchitect
                        ? 'bg-gradient-to-r from-[#b026ff]/25 to-[#6366f1]/25 border border-[#b026ff]/50 text-[#e879f9]'
                        : 'bg-white/[0.06] border border-white/[0.12] text-text-secondary'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isArchitect ? 'bg-status-success shadow-[0_0_8px_#22c55e]' : 'bg-text-muted'
                      }`}
                    />
                    {tierDisplayName}
                  </span>
                </div>

                <div className="flex items-center gap-3.5 text-[13px] text-text-muted">
                  <span>{user?.email}</span>
                  <span className="opacity-30">•</span>
                  <span>{providerName}</span>
                  <span className="opacity-30">•</span>
                  <span>Joined {joinedDate}</span>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-3">
              {!isArchitect ? (
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-gradient-to-r from-[#b026ff] to-[#6366f1] text-white text-[13px] font-semibold cursor-pointer shadow-[0_4px_20px_rgba(176,38,255,0.35)] hover:brightness-110 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b026ff] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
                >
                  <span>✦ Upgrade to Architect</span>
                  <span className="text-[11px] opacity-85">$7.99/mo</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-status-success/10 border border-status-success/30 text-status-success text-[12px] font-semibold">
                  <span>✓</span>
                  <span>Architect Subscription Active</span>
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => { logout(); navigate('/'); }}
                className="text-text-muted hover:text-text-primary"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </section>

        {/* ── HIGH-DENSITY NAVIGATION TABS ── */}
        <div role="tablist" className="flex gap-1.5 border-b border-border-subtle mb-8 overflow-x-auto scrollbar-none">
          {([
            { id: 'entitlements', label: 'Plan & Telemetry Quotas', badge: tierDisplayName },
            { id: 'codebases', label: 'Codebase Registry', count: repos.length },
            { id: 'account', label: 'Account Security' },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`bg-transparent border-none border-b-2 py-3 px-5 text-[13px] font-semibold cursor-pointer inline-flex items-center gap-2 transition-all -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b026ff] rounded-t-sm whitespace-nowrap ${
                  isActive
                    ? 'border-b-[#b026ff] text-text-primary'
                    : 'border-b-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                <span>{tab.label}</span>
                {'badge' in tab && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      isArchitect
                        ? 'bg-[#b026ff]/20 text-[#e879f9] border border-[#b026ff]/30'
                        : 'bg-white/[0.06] text-text-muted border border-white/[0.08]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {'count' in tab && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-text-muted">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── TAB 1: PLAN & TELEMETRY QUOTAS ── */}
        {activeTab === 'entitlements' && (
          <div className="flex flex-col gap-7">

            {/* Plan Status Banner */}
            <div
              className={`border rounded-2xl p-6 sm:p-7 flex items-center justify-between flex-wrap gap-5 ${
                isArchitect
                  ? 'bg-gradient-to-br from-[#b026ff]/[0.08] to-[#6366f1]/[0.04] border-[#b026ff]/25'
                  : 'bg-surface-base/60 border-border-subtle'
              }`}
            >
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span
                    className={`text-[11px] font-bold tracking-[0.1em] uppercase ${
                      isArchitect ? 'text-[#d946ef]' : 'text-text-muted'
                    }`}
                  >
                    {isArchitect ? 'Active Production Subscription' : 'Base Engineering Plan'}
                  </span>
                  <span className="text-[13px] text-text-muted">•</span>
                  <span className="text-[13px] font-semibold text-text-primary">
                    {isArchitect ? '$7.99 / month' : '$0 forever'}
                  </span>
                </div>

                <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-text-primary m-0 mb-1.5">
                  {isArchitect
                    ? 'Continuous Codebase Intelligence & Living Architecture Maps'
                    : 'Deep Architecture Exploration for Individual Developers'}
                </h2>
                <p className="text-[13px] text-text-secondary m-0 max-w-[640px] leading-relaxed">
                  {isArchitect
                    ? 'Your account maintains active AST indexes for up to 10 repositories with deep Blast Radius change impact simulations.'
                    : 'Analyze standalone codebases and inspect dependency hierarchies with authoritative AST parsing at zero friction.'}
                </p>
              </div>

              {!isArchitect ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-gradient-to-r from-[#b026ff] to-[#6366f1] hover:brightness-110 border-0 shadow-[0_4px_18px_rgba(176,38,255,0.3)] text-white whitespace-nowrap"
                >
                  Upgrade to Architect ($7.99/mo) →
                </Button>
              ) : (
                <div className="text-right">
                  <div className="text-[12px] text-text-muted">Renewal / Reset Cycle</div>
                  <div className="text-[13px] font-semibold text-status-success mt-0.5">
                    Active & In Good Standing
                  </div>
                </div>
              )}
            </div>

            {/* 4 Bento Quota Gauges */}
            <div>
              <div className="flex justify-between items-baseline mb-4">
                <h3 className="text-[15px] font-bold tracking-[-0.01em] text-text-primary m-0">
                  Real-Time Resource & Operation Quotas
                </h3>
                <span className="text-[12px] text-text-muted">
                  Authoritative engine telemetry
                </span>
              </div>

              {loadingUsage ? (
                <div className="py-12 text-center text-text-muted text-[13px] bg-surface-base/60 rounded-xl border border-border-subtle flex items-center justify-center gap-2.5">
                  <Spinner size="sm" />
                  <span>Querying live entitlement meters...</span>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
                  {/* Gauge 1: Lifetime Analyses */}
                  <TelemetryCard
                    label="Codebase Analyses"
                    used={usageData?.usage.lifetimeAnalysesUsed ?? 0}
                    limit={usageData?.limits.lifetimeAnalyses ?? 2}
                    isUnlimited={isArchitect}
                    unit={isArchitect ? "runs" : "lifetime passes"}
                    hint={isArchitect ? "Unlimited full repository indexing passes" : "2 free full repository passes included"}
                  />

                  {/* Gauge 2: Active Codebases */}
                  <TelemetryCard
                    label="Active Codebases"
                    used={usageData?.usage.activeCodebases ?? 0}
                    limit={usageData?.limits.maxActiveCodebases ?? 1}
                    unit="simultaneous"
                    hint="Retains live vector embeddings & AST graph"
                  />

                  {/* Gauge 3: AI Questions */}
                  <TelemetryCard
                    label="AI Reasoning Queries"
                    used={usageData?.usage.monthlyAiQuestionsUsed ?? 0}
                    limit={usageData?.limits.monthlyAiQuestions ?? 10}
                    unit="queries / month"
                    hint="Deep graph traversals & codebase RAG queries"
                  />

                  {/* Gauge 4: Monthly Re-indexes */}
                  <TelemetryCard
                    label="Codebase Re-indexes"
                    used={usageData?.usage.monthlyReindexesUsed ?? 0}
                    limit={usageData?.limits.monthlyReindexes ?? 1}
                    unit={isArchitect ? "re-indexes / mo" : "re-index / codebase"}
                    hint={isArchitect ? "30 monthly incremental resynchronizations" : "1 resynchronization per repository"}
                  />
                </div>
              )}
            </div>

            {/* Architecture Capability Matrix */}
            <div className="bg-surface-base/60 border border-border-subtle rounded-2xl p-6 sm:p-7">
              <h3 className="text-[15px] font-bold text-text-primary m-0 mb-4">
                Entitlement Capabilities & Processing Ceilings
              </h3>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
                <CapabilityItem
                  label="Repository Size Ceiling"
                  value={isArchitect ? "50 MB" : "15 MB"}
                  subtext={isArchitect ? "50 MB max uncompressed source" : "15 MB max uncompressed source"}
                />
                <CapabilityItem
                  label="File Count Ceiling"
                  value={isArchitect ? "2,000 files" : "400 files"}
                  subtext={isArchitect ? "Scales to large production monoliths" : "Suited for focused libraries/services"}
                />
                <CapabilityItem
                  label="Blast Radius Simulation"
                  value={isArchitect ? "Enabled ✦" : "Architect Only"}
                  highlight={isArchitect}
                  subtext="Simulates cross-module impact of PR changes"
                />
                <CapabilityItem
                  label="Indexing Pipeline"
                  value={isArchitect ? "Priority Queue" : "Standard Queue"}
                  highlight={isArchitect}
                  subtext="Fast-path worker allocation for new commits"
                />
              </div>

              {!isArchitect && (
                <div className="mt-5 pt-4 border-t border-border-subtle/80 flex justify-between items-center flex-wrap gap-3">
                  <div className="text-[13px] text-text-secondary">
                    Need to index larger repositories or simulate blast radius impacts?
                  </div>
                  <Link
                    to="/pricing"
                    className="text-[13px] text-[#c084fc] hover:underline font-semibold no-underline transition-colors"
                  >
                    Compare full plan specifications →
                  </Link>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── TAB 2: CODEBASE REGISTRY ── */}
        {activeTab === 'codebases' && (
          <div className="flex flex-col gap-5">
            {/* Header with shortcut to History */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-[16px] font-bold text-text-primary m-0">
                  Active & Archived Codebases
                </h3>
                <p className="text-[13px] text-text-muted mt-0.5 mb-0">
                  {usageData?.usage.activeCodebases ?? 0} of {usageData?.limits.maxActiveCodebases ?? 1} active slots utilized.
                </p>
              </div>

              <Link
                to="/history"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-border-subtle text-text-primary text-[12px] font-semibold no-underline transition-colors"
              >
                Open Full Registry →
              </Link>
            </div>

            {reposLoading ? (
              <div className="py-10 text-center text-text-muted text-[13px] flex items-center justify-center gap-2.5">
                <Spinner size="md" />
                <span>Loading registered repositories...</span>
              </div>
            ) : repos.length === 0 ? (
              <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-12 text-center">
                <div className="text-[32px] mb-3 opacity-40">📂</div>
                <h4 className="text-[16px] font-bold text-text-primary m-0 mb-1.5">
                  No Codebases Registered Yet
                </h4>
                <p className="text-[13px] text-text-muted max-w-[380px] mx-auto mb-5">
                  Analyze a GitHub repository or upload a ZIP archive to generate your first architecture map.
                </p>
                <Link
                  to="/dashboard/new"
                  className="inline-block px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#b026ff] to-[#6366f1] text-white text-[13px] font-semibold no-underline shadow-[0_4px_16px_rgba(176,38,255,0.3)] hover:brightness-110 transition-all"
                >
                  Analyze New Repository
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {repos.map((repo) => {
                  const isArchived = Boolean(repo.isArchived);
                  return (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-3.5 sm:p-5 rounded-xl bg-surface-base/80 border border-border-subtle hover:border-border-default transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-[14px] font-semibold text-text-primary">
                            {repo.name}
                          </span>
                          {isArchived ? (
                            <Badge variant="neutral">
                              Archived
                            </Badge>
                          ) : (
                            <Badge variant="success" showDot>
                              Active Slot
                            </Badge>
                          )}
                        </div>
                        <div className="text-[12px] text-text-muted mt-1">
                          Branch: <span className="text-text-secondary">{repo.branch || 'main'}</span>
                          {repo.fileCount ? ` • ${repo.fileCount} files` : ''}
                          {` • Indexed ${new Date(repo.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Link
                          to={`/dashboard/${repo.id}`}
                          className="px-3.5 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] border border-border-subtle text-text-primary text-[12px] font-medium no-underline transition-colors"
                        >
                          Open Graph →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: ACCOUNT SECURITY ── */}
        {activeTab === 'account' && (
          <div className="max-w-[640px] flex flex-col gap-6">
            {/* Display Name Edit */}
            <form
              onSubmit={handleSaveProfile}
              className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-4.5"
            >
              <div>
                <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1">
                  Display Identity
                </h3>
                <p className="text-[13px] text-text-muted m-0">
                  Manage the public name visible in shared architecture graphs and team views.
                </p>
              </div>

              <FormField id="profile-name" label="Full Name">
                <Input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                />
              </FormField>

              <FormField id="profile-email" label="Primary Email">
                <Input
                  id="profile-email"
                  type="email"
                  disabled
                  value={user?.email || ''}
                />
              </FormField>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={profileSaving}
                  isLoading={profileSaving}
                  className="bg-gradient-to-r from-[#b026ff] to-[#6366f1] hover:brightness-110 border-0 text-white"
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </Button>
              </div>
            </form>

            {/* Password Management */}
            {user?.provider === 'email' ? (
              <form
                onSubmit={handleChangePassword}
                className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-4.5"
              >
                <div>
                  <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1">
                    Change Password
                  </h3>
                  <p className="text-[13px] text-text-muted m-0">
                    Enter your existing password to set a new 8+ character password.
                  </p>
                </div>

                <FormField id="current-password" label="Current Password" required>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </FormField>

                <FormField id="new-password" label="New Password" helperText="Must be at least 8 characters" required>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </FormField>

                <FormField id="confirm-password" label="Confirm New Password" required>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </FormField>

                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={pwSaving}
                    isLoading={pwSaving}
                    className="bg-gradient-to-r from-[#b026ff] to-[#6366f1] hover:brightness-110 border-0 text-white"
                  >
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7">
                <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1.5">
                  Federated Identity
                </h3>
                <p className="text-[13px] text-text-muted m-0 leading-relaxed">
                  You are authenticated via <strong className="text-text-primary">{providerName}</strong>. Security tokens and password policies are governed directly by your OAuth provider.
                </p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── UPGRADE TO ARCHITECT MODAL ── */}
      <Modal
        isOpen={showUpgradeModal}
        onClose={() => !upgrading && setShowUpgradeModal(false)}
        title="Upgrade to Archon Architect"
        description="$7.99 / month — Instant entitlement activation"
        maxWidth="md"
        className="border-[#b026ff]/30 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(176,38,255,0.15)]"
      >
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-[13px] text-text-secondary leading-relaxed mb-6">
          <div className="font-semibold text-white mb-2">
            What activates immediately:
          </div>
          <ul className="pl-4.5 m-0 flex flex-col gap-1.5 list-disc">
            <li><strong className="text-white">10 active codebases</strong> retained with full index state</li>
            <li><strong className="text-white">2,000 files & 50 MB</strong> capacity per repository</li>
            <li><strong className="text-white">500 monthly AI questions</strong> & 30 re-indexes</li>
            <li><strong className="text-white">Deep Impact & Blast Radius</strong> change simulations</li>
            <li><strong className="text-white">Priority indexing queue</strong> with accelerated AST generation</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={upgrading}
            onClick={() => setShowUpgradeModal(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={upgrading}
            isLoading={upgrading}
            onClick={handleUpgradeToArchitect}
            className="bg-gradient-to-r from-[#b026ff] to-[#6366f1] hover:brightness-110 border-0 shadow-[0_4px_16px_rgba(176,38,255,0.3)] text-white"
          >
            {upgrading ? 'Activating...' : 'Activate Architect Plan ($7.99/mo)'}
          </Button>
        </div>
      </Modal>

      <Footer />
    </div>
  );
}

/* ── Auxiliary Subcomponents ── */

function TelemetryCard({
  label,
  used,
  limit,
  isUnlimited = false,
  unit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  isUnlimited?: boolean;
  unit: string;
  hint: string;
}) {
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <Card
      variant="default"
      hoverable={false}
      className="p-5 flex flex-col justify-between rounded-xl bg-surface-base/80 border-border-subtle"
    >
      <div>
        <div className="text-[12px] font-semibold text-text-muted uppercase tracking-[0.04em] mb-2">
          {label}
        </div>
        <div className="flex items-baseline gap-1.5 mb-1.5">
          <span
            className={`text-[26px] font-extrabold tracking-[-0.03em] font-mono ${
              isAtLimit ? 'text-status-error' : isNearLimit ? 'text-status-warning' : 'text-text-primary'
            }`}
          >
            {used}
          </span>
          <span className="text-[13px] text-text-muted">
            {isUnlimited ? '(Unlimited)' : `/ ${limit} ${unit}`}
          </span>
        </div>
      </div>

      <div>
        {!isUnlimited ? (
          <div
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={`${label} quota`}
            className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden my-2.5"
          >
            <div
              style={{ width: `${percentage}%` }}
              className={`h-full transition-[width] duration-400 ease-out ${
                isAtLimit
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : isNearLimit
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                  : 'bg-gradient-to-r from-[#b026ff] to-[#6366f1]'
              }`}
            />
          </div>
        ) : (
          <div className="w-full h-1.5 bg-status-success/15 rounded-full overflow-hidden my-2.5">
            <div className="w-full h-full bg-status-success/60 rounded-full" />
          </div>
        )}
        <div className="text-[11px] text-text-muted leading-relaxed">
          {hint}
        </div>
      </div>
    </Card>
  );
}

function CapabilityItem({
  label,
  value,
  subtext,
  highlight = false,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/[0.02] border border-border-subtle/60 rounded-lg p-3.5 sm:p-4">
      <div className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.04em]">
        {label}
      </div>
      <div
        className={`text-[15px] font-bold my-1 ${
          highlight ? 'text-[#c084fc]' : 'text-text-primary'
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-text-muted">
        {subtext}
      </div>
    </div>
  );
}

