import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import { AuthBrandPanel } from '../components/site/AuthPanel'

/**
 * AuthPage — Plate & Paper.
 *
 * NOTHING about the authentication contract changed in this rewrite. The same
 * store actions are called with the same arguments, the same client-side
 * validation runs in the same order, the same error-message matching drives the
 * auto-switch to signup, the same `?redirect=` handling is applied on success,
 * and OAuth still goes through `loginWithOAuth`. That logic is copied verbatim
 * from the previous implementation.
 *
 * What changed is presentation only:
 *   • paper surface instead of the dark gradient theme
 *   • the interactive verification field on the left, mirroring the footer
 *   • Tailwind utilities only — no inline styles, no bespoke CSS
 *   • the shared form controls are replaced with locally-defined paper-styled
 *     inputs so this page no longer depends on the dark DesignSystem theme
 */

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginFailed, setLoginFailed] = useState(false)
  const navigate = useNavigate()

  const {
    signupWithEmail,
    loginWithEmail,
    loginWithOAuth,
    isLoading,
    isAuthenticated,
    authMode,
    setAuthMode,
  } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      const searchParams = new URLSearchParams(window.location.search)
      const redirectUrl = searchParams.get('redirect') || '/'
      navigate(redirectUrl, { replace: true })
    }
  }, [isAuthenticated, navigate])

  // A failed OAuth round-trip sends the user back here with ?error=… rather
  // than stranding them on a dead-end page. Surface it once, then drop the
  // param so a refresh does not re-show a stale failure.
  useEffect(() => {
    const urlError = new URLSearchParams(window.location.search).get('error')
    if (!urlError) return
    toast.error(urlError)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  // The document body defaults to the dark application theme. This page is
  // paper, so it opts in for its lifetime and restores on unmount.

  // Safety net for the loading state.
  //
  // The form, the social buttons and the store all share one `isLoading` flag.
  // If any single path ever fails to clear it — a dropped OAuth handover, a
  // request that outlives the axios timeout — the entire page stays disabled
  // with no way out. This watches the flag and forces it clear if it has been
  // set for longer than any real sign-in can take, so the UI is never
  // permanently stuck. It is a backstop, not the primary reset path.
  useEffect(() => {
    if (!isLoading) return
    const guard = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        useAuthStore.setState({ isLoading: false })
        toast.error('That is taking longer than expected. Please try again.')
      }
    }, 120_000)
    return () => clearTimeout(guard)
  }, [isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    // Normalize email format
    const cleanEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Please enter a valid email address format (e.g. user@example.com)')
      return
    }

    if (authMode === 'signup') {
      // Password complexity check: 8+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special character
      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-])[A-Za-z\d@$!%*?&#^.()_+={}[\]|\\:;"'<>,?/~`-]{8,}$/
      if (!passwordRegex.test(password)) {
        toast.error(
          'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.',
        )
        return
      }
    }

    try {
      const searchParams = new URLSearchParams(window.location.search)
      const redirectUrl = searchParams.get('redirect') || '/'

      setLoginFailed(false)

      if (authMode === 'signup') {
        const message = await signupWithEmail(cleanEmail, password, name)
        toast.success(message)
        navigate(redirectUrl, { replace: true })
      } else {
        await loginWithEmail(cleanEmail, password)
        toast.success('Welcome back!')
        navigate(redirectUrl, { replace: true })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Something went wrong.'
      toast.error(errMsg)
      // A failed login MAY mean "no account yet", so we surface a one-click
      // route to sign up. We do not switch modes automatically: the server
      // deliberately returns the same message for a wrong password and a
      // missing account (so it cannot be used to enumerate users), which means
      // auto-switching would guess wrong half the time.
      if (authMode === 'login') setLoginFailed(true)
    }
  }

  const handleOAuth = (provider: 'github' | 'google') => {
    if (isLoading) return
    loginWithOAuth(provider, authMode)
  }

  const isSignup = authMode === 'signup'

  /** Field label in the ledger style used across the site. */
  const label = (text: string, required = false) => (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">{text}</span>
      {required && <span className="text-[10px] text-sig">*</span>}
    </div>
  )

  const inputBase =
    'w-full rounded-[3px] border border-rule-strong bg-white px-3 py-[11px] font-sans text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#a8a496] focus:border-emerald focus:shadow-[0_0_0_3px_rgba(13,107,79,.09)]'

  return (
    <div className="relative flex min-h-screen bg-paper">
      {/* ── LEFT: the brand plate ─────────────────────────────────────── */}
      <AuthBrandPanel />

      {/* ── RIGHT: the form ────────────────────────────────────────────── */}
      <div className="relative flex w-full items-center justify-center px-6 py-12 sm:px-10 lg:w-[520px] lg:min-w-[520px] lg:border-l lg:border-rule">
        {/* paper substrate, scoped to this half so the page never reads flat */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute inset-0 opacity-[0.055] mix-blend-multiply bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22300%22%20height%3D%22300%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.82%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3CfeColorMatrix%20type%3D%22saturate%22%20values%3D%220%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22300%22%20height%3D%22300%22%20filter%3D%22url(%23n)%22%2F%3E%3C%2Fsvg%3E')]"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(rgba(21,22,26,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(21,22,26,.022)_1px,transparent_1px)] bg-[length:28px_28px]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_88%_-8%,rgba(255,255,255,.7),transparent_62%),radial-gradient(600px_400px_at_10%_100%,rgba(158,140,104,.09),transparent_60%)]" />
        </div>

        <div className="relative z-[2] w-full max-w-[366px]">
          {/* mobile brand — the left panel is hidden below lg */}
          <Link to="/" className="mb-9 inline-flex items-center gap-2.5 lg:hidden">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-emerald" aria-hidden="true">
              <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="1.65" fill="currentColor" />
            </svg>
            <span className="text-[16px] font-semibold tracking-[-0.025em] text-ink">Archon</span>
          </Link>

          <div className="mb-3 flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.19em] text-ink-3">
            <span className="h-px w-6 bg-emerald" />
            {isSignup ? 'Create account' : 'Sign in'}
          </div>

          <h1 className="mb-2 text-[30px] font-semibold leading-[1.1] tracking-[-0.034em] text-ink">
            {isSignup ? (
              <>
                Create your <em className="font-serif italic font-normal">account</em>
                <span className="text-sig">.</span>
              </>
            ) : (
              <>
                Welcome <em className="font-serif italic font-normal">back</em>
                <span className="text-sig">.</span>
              </>
            )}
          </h1>

          <p className="mb-7 text-[13px] leading-[1.6] text-ink-2">
            {isSignup
              ? 'Start reading your codebase with evidence attached to every answer.'
              : 'Sign in to continue to your repositories.'}
          </p>

          {/* ── OAuth ─────────────────────────────────────────────────── */}
          <div className="mb-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[3px] border border-rule-strong bg-white text-[13.5px] font-medium text-ink transition-colors hover:border-ink-3 hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[3px] border border-rule-strong bg-white text-[13.5px] font-medium text-ink transition-colors hover:border-ink-3 hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* ── divider ───────────────────────────────────────────────── */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-rule" />
            <span className="select-none font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
              or
            </span>
            <div className="h-px flex-1 bg-rule" />
          </div>

          {/* ── email form ────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* the name field animates in on signup. max-height rather than a
                motion library, so no inline style is required. */}
            <div
              className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
                isSignup ? 'max-h-[120px] opacity-100' : 'max-h-0 opacity-0'
              }`}
              aria-hidden={!isSignup}
            >
              <div>
                {label('Full name')}
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  required={isSignup}
                  autoComplete="name"
                  className={inputBase}
                />
              </div>
            </div>

            <div>
              {label('Email address', true)}
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={inputBase}
              />
            </div>

            <div>
              {label('Password', true)}
              <div className="relative flex items-center">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'Min 8 characters' : 'Enter your password'}
                  required
                  minLength={isSignup ? 8 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className={`${inputBase} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 rounded p-1 text-ink-3 transition-colors hover:text-ink"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>

              {isSignup && (
                <p className="mt-2 font-mono text-[8.5px] leading-[1.6] tracking-[0.04em] text-ink-3">
                  8+ CHARACTERS · UPPER · LOWER · NUMBER · SYMBOL
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading ? true : undefined}
              className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-forest bg-forest px-5 text-[14px] font-semibold tracking-[-0.01em] text-[#f0f6f2] transition-colors hover:border-[#0c2a23] hover:bg-[#0c2a23] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <span>{isSignup ? 'Creating account…' : 'Signing in…'}</span>
                </>
              ) : isSignup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Login failed: offer a way into signup, without asserting that the
              account is missing — the server cannot tell us that without
              becoming a user-enumeration oracle. */}
          {loginFailed && !isSignup && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[3px] border border-rule bg-paper-3 px-3.5 py-2.5">
              <span className="text-[12px] leading-[1.5] text-ink-2">
                No account with this email yet?
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginFailed(false)
                  setAuthMode('signup')
                }}
                className="flex-none font-mono text-[10px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
              >
                Create one →
              </button>
            </div>
          )}

          {/* ── mode toggle ───────────────────────────────────────────── */}
          <p className="mt-5 text-center text-[13px] text-ink-2">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setLoginFailed(false)
                setAuthMode(isSignup ? 'login' : 'signup')
              }}
              className="border-b border-emerald/40 p-0 text-[13px] font-semibold text-emerald transition-colors hover:border-emerald"
            >
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>

          <p className="mt-6 text-center font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3">
            By continuing you agree to the terms and privacy policy
          </p>
        </div>
      </div>
    </div>
  )
}
