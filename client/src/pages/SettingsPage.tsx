import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Button, Badge, FormField, Input, Toggle } from '../components/ui/DesignSystem';

const PREFERENCES_STORAGE_KEY = 'archon_workspace_preferences';

interface WorkspacePreferences {
  defaultBranch: string;
  autoReindexOnPush: boolean;
  telemetryEnabled: boolean;
}

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  defaultBranch: 'main',
  autoReindexOnPush: true,
  telemetryEnabled: true,
};

export default function SettingsPage() {
  const { user, fetchUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'security'>('general');
  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences state with persistent storage hydration
  const [defaultBranch, setDefaultBranch] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (saved) return JSON.parse(saved).defaultBranch || 'main';
    } catch {}
    return DEFAULT_PREFERENCES.defaultBranch;
  });

  const [autoReindexOnPush, setAutoReindexOnPush] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (saved) return JSON.parse(saved).autoReindexOnPush ?? true;
    } catch {}
    return DEFAULT_PREFERENCES.autoReindexOnPush;
  });

  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (saved) return JSON.parse(saved).telemetryEnabled ?? true;
    } catch {}
    return DEFAULT_PREFERENCES.telemetryEnabled;
  });

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

  const handleSavePreferences = () => {
    const prefs: WorkspacePreferences = {
      defaultBranch: defaultBranch.trim() || 'main',
      autoReindexOnPush,
      telemetryEnabled,
    };
    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
      toast.success('Workspace preferences saved.');
    } catch {
      toast.error('Failed to save preferences locally.');
    }
  };

  const handleResetPreferences = () => {
    setDefaultBranch(DEFAULT_PREFERENCES.defaultBranch);
    setAutoReindexOnPush(DEFAULT_PREFERENCES.autoReindexOnPush);
    setTelemetryEnabled(DEFAULT_PREFERENCES.telemetryEnabled);
    try {
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
      toast.info('Preferences reset to default values.');
    } catch {}
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
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-[980px] mx-auto w-full px-6 pt-[120px] pb-[60px]">
        <div className="mb-7">
          <div className="flex items-center gap-2 text-[13px] text-text-muted mb-2">
            <Link to="/profile" className="text-text-secondary hover:text-text-primary no-underline transition-colors">
              Profile
            </Link>
            <span>/</span>
            <span className="text-text-primary">Settings</span>
          </div>
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-white m-0 mb-1.5">
            Workspace Settings
          </h1>
          <p className="text-[14px] text-text-muted m-0">
            Manage your personal profile, workspace defaults, and security configurations.
          </p>
        </div>

        {/* Plan Entitlements Banner (pointing to Profile) */}
        <div className="mb-8 p-4 sm:p-5 rounded-xl bg-surface-base/60 border border-border-subtle flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-elevated flex items-center justify-center border border-border-subtle shrink-0">
              <span className="text-[15px]">⚡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-text-primary">
                  {isArchitect ? 'Archon Architect Workspace' : 'Explorer Plan (Free)'}
                </span>
                <Badge variant={isArchitect ? 'accent' : 'neutral'} size="sm">
                  {isArchitect ? 'PRO' : 'FREE'}
                </Badge>
              </div>
              <p className="text-[12px] text-text-muted m-0 mt-0.5">
                {isArchitect
                  ? 'Active subscription with 10 codebase slots and full AST reasoning enabled.'
                  : 'Free tier with 1 active codebase slot. Upgrade to unlock multi-repo tracking.'}
              </p>
            </div>
          </div>
          <Link
            to="/profile"
            className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-border-subtle text-text-primary text-[12px] font-semibold no-underline transition-all"
          >
            Manage Entitlements →
          </Link>
        </div>

        {/* Settings Tabs */}
        <div className="flex gap-2 border-b border-border-subtle/80 mb-7">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-1 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'border-accent text-white'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            General Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`pb-3 px-1 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'preferences'
                ? 'border-accent text-white'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Workspace Preferences
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-3 px-1 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'border-accent text-white'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Security & Auth
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'general' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-4.5 max-w-[640px]"
            >
              <div>
                <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1">
                  Personal Profile
                </h3>
                <p className="text-[13px] text-text-muted m-0">
                  Update your public display identity across Archon workspaces.
                </p>
              </div>

              <FormField id="settings-name" label="Display Name">
                <Input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                />
              </FormField>

              <FormField
                id="settings-email"
                label="Email Address"
                helperText={`Managed via your primary ${user?.provider || 'authentication'} account.`}
              >
                <Input
                  id="settings-email"
                  type="email"
                  disabled
                  value={user?.email || ''}
                />
              </FormField>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={savingProfile}
                  isLoading={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-6 max-w-[640px]">
              <div>
                <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1">
                  Workspace Automation & Indexing
                </h3>
                <p className="text-[13px] text-text-muted m-0">
                  Configure how Archon interacts with repositories and handles automatic synchronization.
                </p>
              </div>

              <FormField id="default-branch" label="Default Repository Branch">
                <Input
                  id="default-branch"
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                />
              </FormField>

              <div className="pt-3 border-t border-border-subtle/60">
                <Toggle
                  id="auto-reindex-toggle"
                  label="Auto-synchronize Repository Commits"
                  description="Queue an indexing pass when repository webhooks trigger"
                  checked={autoReindexOnPush}
                  onChange={setAutoReindexOnPush}
                  className="w-full"
                />
              </div>

              <div className="pt-3 border-t border-border-subtle/60">
                <Toggle
                  id="telemetry-toggle"
                  label="Telemetry & Performance Analytics"
                  description="Share anonymous AST parse metrics to improve indexer latency"
                  checked={telemetryEnabled}
                  onChange={setTelemetryEnabled}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleSavePreferences}
                >
                  Save Preferences
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleResetPreferences}
                >
                  Reset Defaults
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="flex flex-col gap-5">
              <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7">
                <h3 className="text-[15px] font-bold text-text-primary m-0 mb-1">
                  Authentication Security
                </h3>
                <p className="text-[13px] text-text-muted m-0 mb-4">
                  Your account is secured via {user?.provider === 'github' ? 'GitHub OAuth' : user?.provider === 'google' ? 'Google OAuth' : 'Email and Password'}.
                </p>
                <Badge variant="success" showDot>
                  Verified active session
                </Badge>
              </div>

              {user?.provider === 'email' && (
                <form
                  onSubmit={handlePasswordChange}
                  className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-4"
                >
                  <h3 className="text-[15px] font-bold text-text-primary m-0">
                    Change Password
                  </h3>

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

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={savingPassword}
                      isLoading={savingPassword}
                    >
                      {savingPassword ? 'Updating...' : 'Update Password'}
                    </Button>
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

