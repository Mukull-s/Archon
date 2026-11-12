import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { Substrate } from '../components/site/Substrate'

/**
 * Landing page for the link in a verification email.
 *
 * The token travels in the query string (`?token=`), which is why it is read
 * here rather than by the store: this route is hit once, from outside the app,
 * and never needs to hold session state. The effect is guarded so React 18's
 * development double-mount cannot consume the token twice.
 */

type Status = 'loading' | 'success' | 'error'

export default function EmailVerify() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')
  const ran = useRef(false)


  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setStatus('error')
      setMessage('This link is missing its verification token.')
      return
    }

    api
      .get(`/auth/verify/${encodeURIComponent(token)}`)
      .then(() => {
        setStatus('success')
        setMessage('Your email is verified. Taking you to sign in…')
        setTimeout(() => navigate('/auth', { replace: true }), 2000)
      })
      .catch(() => {
        setStatus('error')
        setMessage('This link is invalid or has expired. Request a new one by signing up again.')
      })
  }, [navigate])

  return (
    <>
      <Substrate />
      <div className="relative z-[2] flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px] border border-rule bg-paper-2 p-9 text-center shadow-dossier">
          <div className="mb-6 flex items-center justify-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-emerald" aria-hidden="true">
              <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="1.65" fill="currentColor" />
            </svg>
            <span className="text-[15px] font-semibold tracking-[-0.025em] text-ink">Archon</span>
          </div>

          {status === 'loading' && (
            <>
              <div className="mb-4 flex justify-center">
                <span className="text-emerald animate-spin-mark">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
                Verifying your email
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 font-mono text-[9.5px] uppercase tracking-[0.17em] text-emerald">
                Email verified
              </div>
              <p className="text-[13.5px] leading-[1.6] text-ink-2">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4 font-mono text-[9.5px] uppercase tracking-[0.17em] text-sig">
                Verification failed
              </div>
              <p className="mb-6 text-[13.5px] leading-[1.6] text-ink-2">{message}</p>
              <button className="abtn abtn--ghost w-full" onClick={() => navigate('/auth')}>
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
