import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'

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
    const state = params.get('state') || ''
    const email = params.get('email') || undefined
    const name = params.get('name') || undefined

    if (!code) {
      setError('No authorization code received.')
      return
    }

    // CSRF Token Validation
    const storedCsrf = localStorage.getItem('oauth_csrf_token')
    const [providerFromState, csrfToken] = state.split(':')

    if (!csrfToken || csrfToken !== storedCsrf) {
      setError('Security verification failed. OAuth CSRF token mismatch.')
      toast.error('OAuth security check failed. CSRF mismatch.')
      return
    }

    // Clear CSRF token once validated
    localStorage.removeItem('oauth_csrf_token')

    const provider = providerFromState || (window.location.href.includes('google') ? 'google' : 'github')
    const isPopup = window.opener !== null

    if (isPopup) {
      // Send code back to parent window
      window.opener.postMessage(
        { type: 'oauth_callback', provider, code, email, name },
        window.location.origin
      )
      window.close()
    } else {
      // Direct mode fallback
      handleOAuthCallback(provider, code, email, name)
        .then(() => navigate('/', { replace: true }))
        .catch((err) => {
          console.error(err)
          setError(err.message || 'Authentication failed. Please try again.')
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
