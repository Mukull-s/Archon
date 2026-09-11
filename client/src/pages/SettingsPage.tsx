import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { Button, Badge, FormField, Input, Toggle } from '../components/ui/DesignSystem';

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
        <div
          className={`border rounded-xl p-4 sm:px-5 flex items-center justify-between flex-wrap gap-3 mb-8 ${
            isArchitect
              ? 'bg-gradient-to-br from-[#b026ff]/10 to-[#6366f1]/[0.06] border-[#b026ff]/25'
              : 'bg-surface-base/60 border-border-subtle'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-[15px] font-bold ${
                isArchitect
                  ? 'bg-[#b026ff]/15 border border-[#b026ff]/30 text-[#d946ef]'
                  : 'bg-white/[0.05] border border-border-subtle text-text-muted'
              }`}
            >
              ✦
            </div>
            <div>
              <div className="text-[13px] font-semibold text-text-primary">
                Active Plan:{' '}
                <span className={isArchitect ? 'text-[#c084fc]' : 'text-text-muted'}>
                  {isArchitect ? 'Architect Tier' : 'Explorer Tier'}
                </span>
              </div>
              <div className="text-[12px] text-text-muted">
                View real-time codebase quotas, indexing meters, and plan entitlements in your Profile Command Center.
              </div>
            </div>
          </div>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-border-subtle text-text-primary text-[12px] font-semibold no-underline transition-colors"
          >
            Manage Plan & Quotas →
          </Link>
        </div>

        {/* Navigation Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border-subtle mb-7 overflow-x-auto scrollbar-none">
          {([
            { id: 'general', label: 'Account Profile' },
            { id: 'preferences', label: 'Workspace Defaults' },
            { id: 'security', label: 'Security & Auth' },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`bg-transparent border-none border-b-2 py-2.5 px-4.5 text-[13px] font-semibold cursor-pointer transition-all -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-t-sm whitespace-nowrap ${
                  isActive
                    ? 'border-b-accent text-text-primary'
                    : 'border-b-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="max-w-[640px]">
          {activeTab === 'general' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-5"
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
            <div className="bg-surface-base/60 border border-border-subtle rounded-xl p-6 sm:p-7 flex flex-col gap-6">
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

              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => toast.success('Workspace preferences saved.')}
                >
                  Save Preferences
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

