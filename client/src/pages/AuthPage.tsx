import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import Beams from '../components/Beams'
import { FormField, Input, Spinner } from '../components/ui/DesignSystem'

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
      const searchParams = new URLSearchParams(window.location.search)
      const redirectUrl = searchParams.get('redirect') || '/'
      navigate(redirectUrl, { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return;
    
    // Normalize email format
    const cleanEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
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
      const searchParams = new URLSearchParams(window.location.search)
      const redirectUrl = searchParams.get('redirect') || '/'

      if (authMode === 'signup') {
        const message = await signupWithEmail(cleanEmail, password, name)
        toast.success(message)
        navigate(redirectUrl, { replace: true })
      } else {
        await loginWithEmail(cleanEmail, password)
        toast.success('Welcome back!')
        navigate(redirectUrl, { replace: true })
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
    if (isLoading) return;
    loginWithOAuth(provider, authMode)
  }

  return (
    <div id="auth-wrapper" className="min-h-screen flex bg-black relative overflow-hidden">
      {/* ── LEFT SIDE: Beams Background + Headline ── */}
      <div className="auth-left hidden min-[901px]:flex flex-1 relative items-center justify-center overflow-hidden min-h-screen">
        {/* Beams 3D Background */}
        <div className="absolute inset-0 z-0 opacity-70 pointer-events-none">
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
        <div className="absolute inset-0 z-[1] bg-gradient-to-br from-black/60 via-black/30 to-black/70 pointer-events-none" />

        {/* Headline content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="relative z-[2] p-12 max-w-[520px]"
        >
          {/* Logo Monogram */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 no-underline mb-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          >
            <img src="/Archonlogo.png" alt="Archon Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-[18px] text-white tracking-[-0.03em]">
              Archon
            </span>
          </Link>

          <h1 className="text-[42px] font-extrabold text-white leading-[1.1] tracking-[-0.04em] mb-4">
            Understand your
            <br />
            <span className="bg-gradient-to-r from-[#FF9FFC] via-[#b026ff] to-[#7b2ff7] bg-clip-text text-transparent">
              entire codebase
            </span>
            <br />
            in seconds.
          </h1>

          <p className="text-[16px] text-white/55 leading-[1.6] mb-9 max-w-[400px]">
            Archon maps every dependency, predicts the impact of your changes, and helps you ship with confidence — powered by AI.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Impact Analysis', 'Dependency Mapping', 'AI-Powered Chat', 'Zero Config'].map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[12px] font-medium text-white/50 select-none"
              >
                <span className="text-[#FF9FFC]" aria-hidden="true">✦</span>
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT SIDE: Auth Form ── */}
      <div className="auth-right w-full min-[901px]:w-[480px] min-[901px]:min-w-[480px] flex items-center justify-center bg-[#08050f]/95 min-[901px]:border-l border-white/[0.04] p-6 sm:p-10 relative z-[2] min-h-screen">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="w-full max-w-[360px]"
        >
          {/* Title */}
          <h2 className="text-[24px] font-bold text-white mb-1 tracking-[-0.03em]">
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-[13px] text-text-muted mb-7">
            {authMode === 'login' ? 'Sign in to continue to Archon' : 'Start analyzing your codebase with AI'}
          </p>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={isLoading}
              className="w-full h-11 px-4 flex items-center justify-center gap-2.5 rounded-md text-[13.5px] font-medium text-white font-sans transition-all duration-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
              className="w-full h-11 px-4 flex items-center justify-center gap-2.5 rounded-md text-[13.5px] font-medium text-white font-sans transition-all duration-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[11px] text-text-muted font-medium uppercase tracking-[0.05em] select-none">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <AnimatePresence mode="wait">
              {authMode === 'signup' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FormField id="auth-name" label="Full name" required>
                    <Input
                      id="auth-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="bg-white/[0.03] border-white/[0.08] focus-visible:border-[#FF9FFC]/60 focus-visible:ring-[#FF9FFC]/40 text-[13.5px]"
                    />
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            <FormField id="auth-email" label="Email address" required>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-white/[0.03] border-white/[0.08] focus-visible:border-[#FF9FFC]/60 focus-visible:ring-[#FF9FFC]/40 text-[13.5px]"
              />
            </FormField>

            <div className="flex flex-col gap-1.5 w-full">
              <label
                htmlFor="auth-password"
                className="block text-[12px] font-medium text-text-secondary select-none"
              >
                Password <span className="text-status-error ml-1" aria-hidden="true">*</span>
              </label>
              <div className="relative flex items-center w-full">
                <Input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Min 8 characters' : 'Enter your password'}
                  required
                  minLength={authMode === 'signup' ? 8 : undefined}
                  className="pr-10 bg-white/[0.03] border-white/[0.08] focus-visible:border-[#FF9FFC]/60 focus-visible:ring-[#FF9FFC]/40 text-[13.5px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9FFC]/40"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading ? true : undefined}
              className="w-full h-11 px-5 mt-1 rounded-md font-heading font-semibold text-[14px] text-white tracking-[-0.01em] transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b026ff] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base bg-gradient-to-r from-[#b026ff] to-[#7b2ff7] hover:brightness-110 active:scale-[0.99] shadow-[0_0_20px_rgba(176,38,255,0.35)]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" className="text-white" />
                  <span>{authMode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
                </span>
              ) : (
                authMode === 'signup' ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <p className="text-center mt-5 mb-0 text-[13px] text-text-muted">
            {authMode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="bg-transparent border-none text-[#FF9FFC] hover:underline cursor-pointer text-[13px] font-semibold font-sans p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9FFC] rounded-sm"
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

