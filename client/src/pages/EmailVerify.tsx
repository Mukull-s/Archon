import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

/**
 * Email Verification Page
 * User lands here from the verification email link.
 */
export default function EmailVerify() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setStatus('error')
      setMessage('Invalid verification link.')
      return
    }

    api.get(`/auth/verify/${token}`)
      .then(() => {
        setStatus('success')
        setMessage('Your email has been verified! Redirecting...')
        setTimeout(() => navigate('/', { replace: true }), 2000)
      })
      .catch(() => {
        setStatus('error')
        setMessage('Verification failed. The link may have expired.')
      })
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px', padding: '40px 32px',
        maxWidth: '400px',
      }}>
        {status === 'loading' && (
          <>
            <div style={{
              width: '40px', height: '40px',
              border: '3px solid rgba(176,38,255,0.15)', borderTopColor: 'var(--accent)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Email Verified!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>{message}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Verification Failed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px' }}>{message}</p>
            <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '10px 24px', fontSize: '14px' }}>
              Back to Sign In
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
