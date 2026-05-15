import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

/**
 * OAuth Callback Page
 * 
 * GitHub redirects here with ?code=xxx after user consents.
 * This page exchanges the code for a JWT, then redirects to home.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const handleCallback = useAuthStore((s) => s.handleCallback)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (!code) {
      setError('No authorization code received from GitHub.')
      return
    }

    handleCallback(code)
      .then(() => {
        navigate('/', { replace: true })
      })
      .catch(() => {
        setError('Authentication failed. Please try again.')
      })
  }, [handleCallback, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{ textAlign: 'center' }}>
        {error ? (
          <>
            <div style={{
              fontSize: '48px', marginBottom: '16px',
            }}>⚠️</div>
            <p style={{
              color: '#ef4444', fontSize: '16px', fontWeight: 600,
              marginBottom: '12px',
            }}>{error}</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
              style={{ padding: '10px 24px', fontSize: '14px' }}
            >
              Back to Home
            </button>
          </>
        ) : (
          <>
            {/* Spinning loader */}
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(176,38,255,0.15)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{
              color: 'var(--text-secondary)', fontSize: '15px',
              fontWeight: 500,
            }}>
              Authenticating with GitHub...
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
