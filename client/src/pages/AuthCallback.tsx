import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/**
 * OAuth Callback Page
 * 
 * Works in 2 modes:
 * 1. POPUP mode: sends message back to parent window and closes
 * 2. DIRECT mode: exchanges code directly (fallback if popup is blocked)
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const handleOAuthCallback = useAuthStore((s) => s.handleOAuthCallback)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (!code) {
      setError('No authorization code received.')
      return
    }

    // Detect provider from the URL or state
    // GitHub uses 'code' param, Google also uses 'code'
    // We'll determine provider from referrer or pass via state
    const isPopup = window.opener !== null

    if (isPopup) {
      // Send code back to parent window
      // Determine provider by checking URL patterns
      const provider = window.location.href.includes('google') ? 'google' : 'github'
      window.opener.postMessage(
        { type: 'oauth_callback', provider, code },
        window.location.origin
      )
      window.close()
    } else {
      // Direct mode (popup was blocked) — try GitHub first
      handleOAuthCallback('github', code)
        .then(() => navigate('/', { replace: true }))
        .catch(() => {
          // Try Google if GitHub fails
          handleOAuthCallback('google', code)
            .then(() => navigate('/', { replace: true }))
            .catch(() => setError('Authentication failed. Please try again.'))
        })
    }
  }, [handleOAuthCallback, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: '#ef4444', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>{error}</p>
            <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '10px 24px', fontSize: '14px' }}>
              Back to Sign In
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(176,38,255,0.15)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500 }}>
              Authenticating...
            </p>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
