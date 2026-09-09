import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

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
    <div style={{ minHeight: '100vh', background: '#07060b', color: '#f4f4f5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1080px', margin: '0 auto', width: '100%', padding: '120px 24px 70px' }}>

        {/* ── COMMAND HEADER ── */}
        <section style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% -20%, rgba(176,38,255,0.12) 0%, rgba(15,12,23,0.6) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '32px 36px',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}>
          {/* Subtle top edge glow */}
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(176,38,255,0.6), transparent)',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
          }}>
            {/* Identity badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '74px', height: '74px', borderRadius: '18px',
                background: user?.avatarUrl
                  ? 'transparent'
                  : 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                border: '2px solid rgba(176,38,255,0.4)',
                boxShadow: '0 0 24px rgba(176,38,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
                fontSize: '28px', fontWeight: 800, color: '#fff',
              }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()
                )}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', margin: 0 }}>
                    {user?.name || user?.email?.split('@')[0] || 'Developer'}
                  </h1>

                  {/* Tier pill */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '100px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: isArchitect
                      ? 'linear-gradient(135deg, rgba(176,38,255,0.25) 0%, rgba(99,102,241,0.25) 100%)'
                      : 'rgba(255,255,255,0.06)',
                    border: isArchitect
                      ? '1px solid rgba(176,38,255,0.5)'
                      : '1px solid rgba(255,255,255,0.12)',
                    color: isArchitect ? '#e879f9' : '#d4d4d8',
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: isArchitect ? '#22c55e' : '#a1a1aa',
                      boxShadow: isArchitect ? '0 0 8px #22c55e' : 'none',
                    }} />
                    {tierDisplayName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: '#a1a1aa' }}>
                  <span>{user?.email}</span>
                  <span style={{ opacity: 0.3 }}>•</span>
                  <span>{providerName}</span>
                  <span style={{ opacity: 0.3 }}>•</span>
                  <span>Joined {joinedDate}</span>
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!isArchitect ? (
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(176,38,255,0.35)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span>✦ Upgrade to Architect</span>
                  <span style={{ fontSize: '11px', opacity: 0.85 }}>$7.99/mo</span>
                </button>
              ) : (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                  color: '#4ade80', fontSize: '12px', fontWeight: 600,
                }}>
                  <span>✓</span>
                  <span>Architect Subscription Active</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => { logout(); navigate('/'); }}
                style={{
                  padding: '9px 16px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#a1a1aa', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </section>

        {/* ── HIGH-DENSITY NAVIGATION TABS ── */}
        <div style={{
          display: 'flex',
          gap: '6px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '32px',
        }}>
          {([
            { id: 'entitlements', label: 'Plan & Telemetry Quotas', badge: tierDisplayName },
            { id: 'codebases', label: 'Codebase Registry', count: repos.length },
            { id: 'account', label: 'Account Security' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #b026ff' : '2px solid transparent',
                padding: '12px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === tab.id ? '#fff' : '#71717a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                marginBottom: '-1px',
              }}
            >
              <span>{tab.label}</span>
              {'badge' in tab && (
                <span style={{
                  fontSize: '10px', padding: '2px 7px', borderRadius: '100px',
                  background: isArchitect ? 'rgba(176,38,255,0.18)' : 'rgba(255,255,255,0.06)',
                  color: isArchitect ? '#e879f9' : '#a1a1aa',
                  border: isArchitect ? '1px solid rgba(176,38,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  {tab.badge}
                </span>
              )}
              {'count' in tab && (
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '100px',
                  background: 'rgba(255,255,255,0.06)', color: '#a1a1aa',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB 1: PLAN & TELEMETRY QUOTAS ── */}
        {activeTab === 'entitlements' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* Plan Status Banner */}
            <div style={{
              background: isArchitect
                ? 'linear-gradient(135deg, rgba(176,38,255,0.08) 0%, rgba(99,102,241,0.04) 100%)'
                : 'rgba(255,255,255,0.02)',
              border: isArchitect
                ? '1px solid rgba(176,38,255,0.25)'
                : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '24px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '20px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: isArchitect ? '#d946ef' : '#a1a1aa',
                  }}>
                    {isArchitect ? 'Active Production Subscription' : 'Base Engineering Plan'}
                  </span>
                  <span style={{ fontSize: '13px', color: '#71717a' }}>•</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                    {isArchitect ? '$7.99 / month' : '$0 forever'}
                  </span>
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', margin: '0 0 6px' }}>
                  {isArchitect
                    ? 'Continuous Codebase Intelligence & Living Architecture Maps'
                    : 'Deep Architecture Exploration for Individual Developers'}
                </h2>
                <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, maxWidth: '640px', lineHeight: 1.5 }}>
                  {isArchitect
                    ? 'Your account maintains active AST indexes for up to 10 repositories with deep Blast Radius change impact simulations.'
                    : 'Analyze standalone codebases and inspect dependency hierarchies with authoritative AST parsing at zero friction.'}
                </p>
              </div>

              {!isArchitect ? (
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(true)}
                  style={{
                    padding: '10px 22px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(176,38,255,0.3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Upgrade to Architect ($7.99/mo) →
                </button>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Renewal / Reset Cycle</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#4ade80', marginTop: '2px' }}>
                    Active & In Good Standing
                  </div>
                </div>
              )}
            </div>

            {/* 4 Bento Quota Gauges */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em', color: '#fff', margin: 0 }}>
                  Real-Time Resource & Operation Quotas
                </h3>
                <span style={{ fontSize: '12px', color: '#71717a' }}>
                  Authoritative engine telemetry
                </span>
              </div>

              {loadingUsage ? (
                <div style={{
                  padding: '48px 0', textAlign: 'center', color: '#71717a', fontSize: '13px',
                  background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  Querying live entitlement meters...
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '16px',
                }}>
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
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              padding: '24px 28px',
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>
                Entitlement Capabilities & Processing Ceilings
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
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
                <div style={{
                  marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
                }}>
                  <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
                    Need to index larger repositories or simulate blast radius impacts?
                  </div>
                  <Link
                    to="/pricing"
                    style={{ fontSize: '13px', color: '#c084fc', fontWeight: 600, textDecoration: 'none' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header with shortcut to History */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Active & Archived Codebases
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: '2px 0 0' }}>
                  {usageData?.usage.activeCodebases ?? 0} of {usageData?.limits.maxActiveCodebases ?? 1} active slots utilized.
                </p>
              </div>

              <Link
                to="/history"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: '12px', fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Open Full Registry →
              </Link>
            </div>

            {reposLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                Loading registered repositories...
              </div>
            ) : repos.length === 0 ? (
              <div style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '14px', padding: '48px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>📂</div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
                  No Codebases Registered Yet
                </h4>
                <p style={{ fontSize: '13px', color: '#71717a', maxWidth: '380px', margin: '0 auto 20px' }}>
                  Analyze a GitHub repository or upload a ZIP archive to generate your first architecture map.
                </p>
                <Link
                  to="/dashboard/new"
                  style={{
                    display: 'inline-block',
                    padding: '9px 20px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    color: '#fff', fontSize: '13px', fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Analyze New Repository
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {repos.map((repo) => {
                  const isArchived = Boolean(repo.isArchived);
                  return (
                    <div
                      key={repo.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                            {repo.name}
                          </span>
                          {isArchived ? (
                            <span style={{
                              fontSize: '10px', padding: '2px 7px', borderRadius: '100px',
                              background: 'rgba(255,255,255,0.05)', color: '#71717a',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                              Archived
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '10px', padding: '2px 7px', borderRadius: '100px',
                              background: 'rgba(34,197,94,0.08)', color: '#4ade80',
                              border: '1px solid rgba(34,197,94,0.2)',
                            }}>
                              Active Slot
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '3px' }}>
                          Branch: <span style={{ color: '#a1a1aa' }}>{repo.branch || 'main'}</span>
                          {repo.fileCount ? ` • ${repo.fileCount} files` : ''}
                          {` • Indexed ${new Date(repo.createdAt).toLocaleDateString()}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Link
                          to={`/dashboard/${repo.id}`}
                          style={{
                            padding: '6px 14px', borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#fff', fontSize: '12px', fontWeight: 500,
                            textDecoration: 'none',
                          }}
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
          <div style={{ maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Display Name Edit */}
            <form onSubmit={handleSaveProfile} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '14px',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                  Display Identity
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Manage the public name visible in shared architecture graphs and team views.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Primary Email
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#71717a', fontSize: '13px', cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    padding: '8px 18px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', opacity: profileSaving ? 0.6 : 1,
                  }}
                >
                  {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>

            {/* Password Management */}
            {user?.provider === 'email' ? (
              <form onSubmit={handleChangePassword} style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                    Change Password
                  </h3>
                  <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                    Enter your existing password to set a new 8+ character password.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', marginBottom: '6px' }}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '13px', outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={pwSaving}
                    style={{
                      padding: '8px 18px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                      border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', opacity: pwSaving ? 0.6 : 1,
                    }}
                  >
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '14px',
                padding: '24px 28px',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
                  Federated Identity
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
                  You are authenticated via <strong style={{ color: '#fff' }}>{providerName}</strong>. Security tokens and password policies are governed directly by your OAuth provider.
                </p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── UPGRADE TO ARCHITECT MODAL ── */}
      <AnimatePresence>
        {showUpgradeModal && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px',
            }}
            onClick={() => !upgrading && setShowUpgradeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '480px', width: '100%',
                background: '#0e0a16',
                border: '1px solid rgba(176,38,255,0.3)',
                borderRadius: '16px',
                padding: '28px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(176,38,255,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: 'rgba(176,38,255,0.15)', border: '1px solid rgba(176,38,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#d946ef', fontSize: '20px', fontWeight: 700,
                }}>
                  ✦
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    Upgrade to Archon Architect
                  </h3>
                  <p style={{ fontSize: '13px', color: '#919095', margin: '2px 0 0' }}>
                    $7.99 / month — Instant entitlement activation
                  </p>
                </div>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '16px 18px',
                fontSize: '13px',
                color: '#d4d4d8',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px' }}>
                  What activates immediately:
                </div>
                <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li><strong>10 active codebases</strong> retained with full index state</li>
                  <li><strong>2,000 files & 50 MB</strong> capacity per repository</li>
                  <li><strong>500 monthly AI questions</strong> & 30 re-indexes</li>
                  <li><strong>Deep Impact & Blast Radius</strong> change simulations</li>
                  <li><strong>Priority indexing queue</strong> with accelerated AST generation</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={upgrading}
                  onClick={() => setShowUpgradeModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#a1a1aa',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={upgrading}
                  onClick={handleUpgradeToArchitect}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(176,38,255,0.3)',
                    opacity: upgrading ? 0.6 : 1,
                  }}
                >
                  {upgrading ? 'Activating...' : 'Activate Architect Plan ($7.99/mo)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '14px',
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '26px', fontWeight: 800, color: isAtLimit ? '#f87171' : isNearLimit ? '#fbbf24' : '#fff', letterSpacing: '-0.03em', fontFamily: "'JetBrains Mono', monospace, sans-serif" }}>
            {used}
          </span>
          <span style={{ fontSize: '13px', color: '#71717a' }}>
            {isUnlimited ? '(Unlimited)' : `/ ${limit} ${unit}`}
          </span>
        </div>
      </div>

      <div>
        {!isUnlimited ? (
          <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden', margin: '10px 0 8px' }}>
            <div
              style={{
                width: `${percentage}%`,
                height: '100%',
                background: isAtLimit
                  ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                  : isNearLimit
                  ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(90deg, #b026ff 0%, #6366f1 100%)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        ) : (
          <div style={{ width: '100%', height: '5px', background: 'rgba(34,197,94,0.15)', borderRadius: '999px', margin: '10px 0 8px' }}>
            <div style={{ width: '100%', height: '100%', background: '#22c55e', borderRadius: '999px', opacity: 0.6 }} />
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
    </div>
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
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '10px',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{
        fontSize: '15px', fontWeight: 700, margin: '4px 0 2px',
        color: highlight ? '#c084fc' : '#fff',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: '#71717a' }}>
        {subtext}
      </div>
    </div>
  );
}
