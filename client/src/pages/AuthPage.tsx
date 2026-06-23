import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import Beams from '../components/Beams'
import CinematicCursor from '../components/CinematicCursor'

type AuthMode = 'login' | 'signup'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const { signupWithEmail, loginWithEmail, loginWithOAuth, isLoading, isAuthenticated, authMode, setAuthMode } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Strict email format validation on frontend
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address format (e.g. user@example.com)')
      return
    }

    if (authMode === 'signup') {
      // Password complexity check: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-])[A-Za-z\d@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-]{8,}$/
      if (!passwordRegex.test(password)) {
        toast.error('Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.')
        return
      }
    }

    try {
      if (authMode === 'signup') {
        const message = await signupWithEmail(email, password, name)
        toast.success(message)
        navigate('/')
      } else {
        await loginWithEmail(email, password)
        toast.success('Welcome back!')
        navigate('/')
      }
    } catch (err: any) {
      // If user is not registered, toast and auto-switch to signup!
      const errMsg = err.message || ''
      if (errMsg.includes('not registered') || errMsg.includes('sign up first') || errMsg.includes('not found')) {
        toast.error('No account registered with this email. Switched to Sign Up.')
        setAuthMode('signup')
      } else {
        toast.error(errMsg)
      }
    }
  }

  const handleOAuth = (provider: 'github' | 'google') => {
    loginWithOAuth(provider, authMode)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: '#000',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <CinematicCursor />
      {/* ── LEFT SIDE: Beams Background + Headline ── */}
      <div style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        minHeight: '100vh',
      }}>
        {/* Beams 3D Background */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          opacity: 0.7,
          pointerEvents: 'none',
        }}>
          <Beams
            beamWidth={3}
            beamHeight={30}
            beamNumber={20}
            lightColor="#FF9FFC"
            speed={2}
            noiseIntensity={1.75}
            scale={0.2}
            rotation={30}
          />
        </div>

        {/* Overlay gradient for readability */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Headline content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{
            position: 'relative', zIndex: 2,
            padding: '60px 48px',
            maxWidth: '520px',
          }}
        >
          {/* Logo */}
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            textDecoration: 'none', marginBottom: '48px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #b026ff, #7b2ff7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '18px', color: '#fff', letterSpacing: '-0.03em' }}>
              Archon
            </span>
          </Link>

          <h1 style={{
            fontSize: '42px', fontWeight: 800, color: '#fff',
            lineHeight: 1.1, letterSpacing: '-0.04em',
            margin: '0 0 16px',
          }}>
            Understand your
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #FF9FFC, #b026ff, #7b2ff7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              entire codebase
            </span>
            <br />
            in seconds.
          </h1>

          <p style={{
            fontSize: '16px', color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6, margin: '0 0 36px',
            maxWidth: '400px',
          }}>
            Archon maps every dependency, predicts the impact of your changes, and helps you ship with confidence — powered by AI.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['Impact Analysis', 'Dependency Mapping', 'AI-Powered Chat', 'Zero Config'].map((feature) => (
              <span key={feature} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '100px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '12px', fontWeight: 500,
                color: 'rgba(255,255,255,0.5)',
              }}>
                <span style={{ color: '#FF9FFC' }}>✦</span>
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT SIDE: Auth Form ── */}
      <div style={{
        width: '480px', minWidth: '480px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8, 5, 15, 0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        padding: '40px',
        position: 'relative', zIndex: 2,
      }}>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          style={{ width: '100%', maxWidth: '360px' }}
        >
          {/* Title */}
          <h2 style={{
            fontSize: '24px', fontWeight: 700, color: '#fff',
            margin: '0 0 4px', letterSpacing: '-0.03em',
          }}>
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{
            fontSize: '13px', color: 'var(--text-muted)',
            margin: '0 0 28px',
          }}>
            {authMode === 'login' ? 'Sign in to continue to Archon' : 'Start analyzing your codebase with AI'}
          </p>

          {/* OAuth buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => handleOAuth('github')} disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '11px 16px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: '#fff', fontSize: '13.5px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>

            <button onClick={() => handleOAuth('google')} disabled={isLoading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '11px 16px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: '#fff', fontSize: '13.5px', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <AnimatePresence mode="wait">
              {authMode === 'signup' && (
                <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Full name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required
                    className="auth-input" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                className="auth-input" />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Min 8 characters' : 'Enter your password'} required minLength={authMode === 'signup' ? 8 : undefined}
                  className="auth-input" style={{ paddingRight: '42px' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPassword ? (
                      <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/></>
                    ) : (
                      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading}
              style={{
                width: '100%', padding: '11px 16px', marginTop: '4px',
                background: isLoading ? 'rgba(176,38,255,0.3)' : 'linear-gradient(135deg, #b026ff, #7b2ff7)',
                border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s', letterSpacing: '-0.01em',
              }}>
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="auth-spinner" />
                  {authMode === 'signup' ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                authMode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p style={{ textAlign: 'center', marginTop: '20px', marginBottom: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
            {authMode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              style={{
                background: 'none', border: 'none', color: '#FF9FFC', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', padding: 0,
              }}>
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #fff;
          font-size: 13.5px;
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: rgba(255,159,252,0.4);
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.2);
        }
        .auth-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          display: inline-block;
        }
        @media (max-width: 900px) {
          .auth-left { display: none !important; }
          .auth-right { min-width: 100% !important; width: 100% !important; }
        }
      `}</style>
    </div>
  )
}
