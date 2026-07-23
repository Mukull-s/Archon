import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

interface Repo {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  status: string;
  createdAt: string;
}

type ProfileTab = 'overview' | 'security';

export default function ProfilePage() {
  const { user, logout, fetchUser } = useAuthStore();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Repos
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    setName(user.name || '');
  }, [user]);

  useEffect(() => {
    setReposLoading(true);
    api.get('/repos')
      .then(({ data }) => setRepos((data.data?.repos || data.data || []).slice(0, 5)))
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    if (!name.trim()) { setProfileMsg({ type: 'error', text: 'Name cannot be empty.' }); return; }
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await api.patch('/auth/profile', { name: name.trim() });
      await fetchUser();
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error?.message || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) { setPwMsg({ type: 'error', text: 'New password is required.' }); return; }
    if (newPassword.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' }); return; }
    if (newPassword !== confirmPassword) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return; }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err.response?.data?.error?.message || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';

  const providerLabel: Record<string, string> = { email: 'Email', github: 'GitHub', google: 'Google' };
  const provider = providerLabel[user?.provider || ''] || user?.provider || '—';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fafafa', fontFamily: "'Inter', sans-serif" }}>

      {/* Top bar */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <img src="/Archonlogo.png" alt="Archon" style={{ height: 28, width: 28, objectFit: 'contain' }} />
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>My Profile</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleLogout}
          style={{ fontSize: 12, color: '#ff6b6b', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>

        {/* Avatar + Name header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: user?.avatarUrl ? 'none' : 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
            overflow: 'hidden', flexShrink: 0,
            border: '2px solid rgba(176,38,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#fff',
          }}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user?.name?.[0] || user?.email?.[0] || '?').toUpperCase()
            }
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {user?.name || user?.email?.split('@')[0] || 'User'}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{user?.email}</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Member since {joinedDate} · {provider}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 32 }}>
          {(['overview', 'security'] as ProfileTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '8px 16px', fontSize: 13, fontWeight: 500,
                color: activeTab === tab ? '#b026ff' : 'rgba(255,255,255,0.45)',
                borderBottom: activeTab === tab ? '2px solid #b026ff' : '2px solid transparent',
                marginBottom: -1, transition: 'color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Profile info card */}
            <Card title="Profile Information">
              <Field label="Display Name">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </Field>
              <Field label="Email Address">
                <input value={user?.email || ''} disabled style={{ ...inputStyle, opacity: 0.45, cursor: 'not-allowed' }} />
              </Field>
              {profileMsg && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: profileMsg.type === 'error' ? '#ff6b6b' : '#4ade80' }}>{profileMsg.text}</p>
              )}
              <div style={{ marginTop: 16 }}>
                <ActionButton loading={profileSaving} onClick={handleSaveProfile} disabled={profileSaving}>
                  Save Changes
                </ActionButton>
              </div>
            </Card>

            {/* Recent Repositories */}
            <Card title="Recent Repositories">
              {reposLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : repos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  <p style={{ margin: 0 }}>No repositories yet.</p>
                  <Link to="/dashboard/new" style={{ color: '#b026ff', fontSize: 13, marginTop: 8, display: 'inline-block' }}>
                    Add your first repository →
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {repos.map(repo => (
                    <Link
                      key={repo.id}
                      to={`/dashboard/${repo.id}`}
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(176,38,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#fafafa' }}>{repo.name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{repo.branch} · {new Date(repo.createdAt).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge status={repo.status} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <Card title="Change Password">
              {user?.provider !== 'email' ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  Password changes are only available for email/password accounts.
                  Your account uses <strong style={{ color: '#fafafa' }}>{provider}</strong> sign-in.
                </p>
              ) : (
                <>
                  <Field label="Current Password">
                    <PasswordInput value={currentPassword} onChange={setCurrentPassword} show={showCurrent} onToggle={() => setShowCurrent(v => !v)} placeholder="Enter current password" />
                  </Field>
                  <Field label="New Password">
                    <PasswordInput value={newPassword} onChange={setNewPassword} show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="At least 8 characters" />
                  </Field>
                  <Field label="Confirm New Password">
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="Repeat new password" />
                  </Field>
                  {pwMsg && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: pwMsg.type === 'error' ? '#ff6b6b' : '#4ade80' }}>{pwMsg.text}</p>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <ActionButton loading={pwSaving} onClick={handleChangePassword} disabled={pwSaving}>
                      Update Password
                    </ActionButton>
                  </div>
                </>
              )}
            </Card>

            {/* Account info */}
            <Card title="Account Details">
              <Row label="Provider" value={provider} />
              <Row label="Email Verified" value={user?.emailVerified ? 'Yes' : 'No'} />
              {user?.githubLogin && <Row label="GitHub Login" value={`@${user.githubLogin}`} />}
              <Row label="Member Since" value={joinedDate} />
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ── Helper Components ── */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 }}>
      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ color: '#fafafa', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: 0 }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function ActionButton({ children, onClick, loading, disabled }: { children: React.ReactNode; onClick: () => void; loading?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'linear-gradient(135deg, #b026ff 0%, #6366f1 100%)',
        border: 'none', borderRadius: 8, color: '#fff',
        fontSize: 13, fontWeight: 600, padding: '9px 20px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Saving…' : children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ready: '#4ade80', analyzing: '#fbbf24', pending: '#94a3b8', error: '#f87171',
  };
  const color = colors[status?.toLowerCase()] || '#94a3b8';
  return (
    <span style={{ fontSize: 11, color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 4, padding: '2px 8px', fontWeight: 500 }}>
      {status}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fafafa', fontSize: 13, padding: '9px 12px',
  outline: 'none', fontFamily: "'Inter', sans-serif",
};
