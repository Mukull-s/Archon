import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'security'>('general');
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences state
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [autoReindexOnPush, setAutoReindexOnPush] = useState(true);
  const [telemetryEnabled, setTelemetryEnabled] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      await fetchUser();
      toast.success('Settings updated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const isArchitect = user?.plan === 'pro';

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e1e5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%', padding: '120px 24px 60px' }}>
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#71717a', marginBottom: '8px' }}>
            <Link to="/profile" style={{ color: '#a1a1aa', textDecoration: 'none' }}>Profile</Link>
            <span>/</span>
            <span style={{ color: '#fff' }}>Settings</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '6px' }}>
            Workspace Settings
          </h1>
          <p style={{ fontSize: '14px', color: '#919095' }}>
            Manage your personal profile, workspace defaults, and security configurations.
          </p>
        </div>

        {/* Plan Entitlements Banner (pointing to Profile) */}
        <div style={{
          background: isArchitect
            ? 'linear-gradient(135deg, rgba(176,38,255,0.1) 0%, rgba(99,102,241,0.06) 100%)'
            : 'rgba(255,255,255,0.02)',
          border: isArchitect ? '1px solid rgba(176,38,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '32px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: isArchitect ? 'rgba(176,38,255,0.15)' : 'rgba(255,255,255,0.05)',
              border: isArchitect ? '1px solid rgba(176,38,255,0.3)' : '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isArchitect ? '#d946ef' : '#a1a1aa', fontSize: '15px', fontWeight: 700,
            }}>
              ✦
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                Active Plan: <span style={{ color: isArchitect ? '#c084fc' : '#a1a1aa' }}>{isArchitect ? 'Architect Tier' : 'Explorer Tier'}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#71717a' }}>
                View real-time codebase quotas, indexing meters, and plan entitlements in your Profile Command Center.
              </div>
            </div>
          </div>
          <Link
            to="/profile"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontSize: '12px', fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.2s',
            }}
          >
            Manage Plan & Quotas →
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '28px' }}>
          {([
            { id: 'general', label: 'Account Profile' },
            { id: 'preferences', label: 'Workspace Defaults' },
            { id: 'security', label: 'Security & Auth' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent, #b026ff)' : '2px solid transparent',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === tab.id ? '#fff' : '#71717a',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth: '640px' }}>
          {activeTab === 'general' && (
            <form onSubmit={handleSaveProfile} style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                  Personal Profile
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Update your public display identity across Archon workspaces.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#71717a',
                    fontSize: '13px',
                    cursor: 'not-allowed',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#71717a', marginTop: '4px', display: 'block' }}>
                  Managed via your primary {user?.provider || 'authentication'} account.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '8px' }}>
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: savingProfile ? 0.6 : 1,
                  }}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                  Workspace Automation & Indexing
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
                  Configure how Archon interacts with repositories and handles automatic synchronization.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>
                  Default Repository Branch
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Auto-synchronize Repository Commits</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Queue an indexing pass when repository webhooks trigger</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoReindexOnPush}
                  onChange={(e) => setAutoReindexOnPush(e.target.checked)}
                  style={{ accentColor: '#b026ff', width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Telemetry & Performance Analytics</div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>Share anonymous AST parse metrics to improve indexer latency</div>
                </div>
                <input
                  type="checkbox"
                  checked={telemetryEnabled}
                  onChange={(e) => setTelemetryEnabled(e.target.checked)}
                  style={{ accentColor: '#b026ff', width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toast.success('Workspace preferences saved.')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '12px',
                padding: '24px 28px',
              }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
                  Authentication Security
                </h3>
                <p style={{ fontSize: '13px', color: '#71717a', margin: '0 0 16px' }}>
                  Your account is secured via {user?.provider === 'github' ? 'GitHub OAuth' : user?.provider === 'google' ? 'Google OAuth' : 'Email and Password'}.
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', borderRadius: '8px',
                  background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                  fontSize: '12px', color: '#4ade80', fontWeight: 600,
                }}>
                  ✓ Verified active session
                </div>
              </div>

              {user?.provider === 'email' && (
                <form onSubmit={handlePasswordChange} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px',
                  padding: '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
                    Change Password
                  </h3>

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
                      disabled={savingPassword}
                      style={{
                        padding: '8px 18px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
                        border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', opacity: savingPassword ? 0.6 : 1,
                      }}
                    >
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
