import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'
import { Spinner } from '../components/ui/DesignSystem'

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
  const [success, setSuccess] = useState(false)

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
    const [providerFromState, csrfToken] = (state || '').split(':')

    if (storedCsrf && csrfToken && csrfToken !== storedCsrf) {
      setError('Security verification failed. OAuth CSRF token mismatch.')
      toast.error('OAuth security check failed. CSRF mismatch.')
      return
    }

    // Clear CSRF token once validated
    localStorage.removeItem('oauth_csrf_token')

    const provider = providerFromState || (window.location.href.includes('google') ? 'google' : 'github')
    const isPopup = window.opener !== null || window.name === 'google_auth' || window.name === 'github_auth' || window.innerWidth < 650

    // Exchange OAuth code directly
    handleOAuthCallback(provider, code, email, name)
      .then(() => {
        setSuccess(true)
        const target = localStorage.getItem('auth_redirect_url') || '/'

        const completionPayload = {
          type: 'oauth_complete',
          provider,
          target,
          user: useAuthStore.getState().user,
          token: useAuthStore.getState().token,
        }

        // 1. Broadcast via BroadcastChannel (handles COOP severed opener)
        try {
          const channel = new BroadcastChannel('archon_oauth_channel')
          channel.postMessage(completionPayload)
          setTimeout(() => {
            try { channel.close() } catch {}
          }, 1000)
        } catch {}

        // 2. Broadcast via localStorage storage event (cross-window fallback)
        try {
          localStorage.setItem('archon_oauth_event', JSON.stringify({ ...completionPayload, timestamp: Date.now() }))
        } catch {}

        // 3. Send via postMessage if window.opener is still accessible
        if (window.opener) {
          try {
            window.opener.postMessage(completionPayload, window.location.origin)
          } catch {}
        }

        if (isPopup) {
          // Close popup after letting opener process
          setTimeout(() => {
            try {
              window.close()
            } catch {}
          }, 800)
        } else {
          localStorage.removeItem('auth_redirect_url')
          navigate(target, { replace: true })
        }
      })
      .catch((err: any) => {
        console.error('OAuth exchange error:', err)
        const errMsg = err?.message || 'Authentication failed. Please try again.'
        setError(errMsg)
        toast.error(errMsg)
      })
  }, [handleOAuthCallback, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#09090b',
      color: '#e4e1e5',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
        {error ? (
          <>
            <div style={{ fontSize: '42px', marginBottom: '16px' }}>⚠️</div>
            <p style={{ color: '#ef4444', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>{error}</p>
            <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '8px 20px', fontSize: '13px' }}>
              Back to Sign In
            </button>
          </>
        ) : success ? (
          <>
            <div style={{ fontSize: '42px', marginBottom: '16px', color: '#4ade80' }}>✓</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              Authentication Successful
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
              You are signed in. This window will close automatically, or you can continue below.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                const target = localStorage.getItem('auth_redirect_url') || '/';
                navigate(target, { replace: true });
              }}
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              Continue to Archon
            </button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Spinner size="lg" />
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: 500 }}>
              Completing authentication...
            </p>
          </>
        )}
      </div>
    </div>
  )
}
