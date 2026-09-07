import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { useAuthStore } from '../stores/authStore';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'general' | 'preferences' | 'security'>('general');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#e4e1e5', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: '1120px', margin: '0 auto', width: '100%', padding: '120px 24px 60px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginBottom: '6px' }}>
            Account Settings
          </h1>
          <p style={{ fontSize: '14px', color: '#919095' }}>
            Manage your personal profile, notification preferences, and security settings.
          </p>
        </div>

        {/* Settings Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '32px' }}>
          {(['general', 'preferences', 'security'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent, #b026ff)' : '2px solid transparent',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: activeTab === tab ? '#fff' : '#71717a',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth: '640px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px' }}>
          {activeTab === 'general' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Personal Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Full Name</label>
                  <input
                    type="text"
                    disabled
                    value={user?.name || 'Not provided'}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#a1a1aa',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Email Address</label>
                  <input
                    type="text"
                    disabled
                    value={user?.email || ''}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#a1a1aa',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Auth Provider</label>
                  <span style={{ fontSize: '13px', color: '#fff', textTransform: 'capitalize' }}>{user?.provider || 'Email'}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Workspace Preferences</h2>
              <p style={{ fontSize: '13px', color: '#71717a', lineHeight: 1.6 }}>
                Customizations for code graph layout, default investigation views, and syntax highlighting themes will be configured here.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Authentication & Security</h2>
              <p style={{ fontSize: '13px', color: '#71717a', lineHeight: 1.6, marginBottom: '16px' }}>
                Your account is currently secured with {user?.provider === 'github' ? 'GitHub OAuth' : user?.provider === 'google' ? 'Google OAuth' : 'Email and Password'}.
              </p>
              <div style={{ fontSize: '12px', color: '#4ade80' }}>✓ Verified session active</div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
