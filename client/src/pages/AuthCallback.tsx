import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Substrate } from '../components/site/Substrate'

/**
 * The OAuth redirect target. Providers are configured with
 * `redirect_uri=<CLIENT_URL>/auth/callback`, so every provider round-trip
 * lands here.
 *
 * This page is a *transport*, not a destination. It does exactly three things:
 *   1. exchange the authorization code (through the store)
 *   2. tell the window that is waiting for the result
 *   3. get out of the way
 *
 * On success it either closes (popup mode) or navigates on (direct mode). On
 * failure it does NOT render an error screen — it returns to the sign-in page
 * with `?error=…` so the message appears where the user already is, which is
 * how every mainstream product handles this. A dead-end error page for a
 * retryable social sign-in is worse UX than a toast on the form.
 *
 * Note there is deliberately no client-side CSRF comparison here. The server
 * signs its OAuth `state` with an HMAC and verifies it before exchanging the
 * code (`authService.verifyOAuthState`), which is the check that actually
 * matters; a second, weaker check in the browser only produced false failures
 * when the nonce did not survive the popup round-trip.
 */

/** Pull a readable message out of a failed request without typing on `any`. */
function messageOf(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string }
    if (typeof e.message === 'string' && e.message.trim()) return e.message
  }
  return 'Sign-in failed. Please try again.'
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const handleOAuthCallback = useAuthStore((s) => s.handleOAuthCallback)

  // Read the callback parameters once, during the first render.
  const [params] = useState(() => new URLSearchParams(window.location.search))
  const code = params.get('code')
  const state = params.get('state') || ''
  const email = params.get('email') || undefined
  const name = params.get('name') || undefined
  const started = useRef(false)


  useEffect(() => {
    // React 18 StrictMode mounts effects twice in development. Exchanging the
    // same authorization code twice gets the second attempt rejected by the
    // provider, so guard against the repeat.
    if (started.current) return
    started.current = true

    /** Send the failure back to the sign-in form rather than parking here. */
    const fail = (msg: string) => {
      localStorage.removeItem('auth_redirect_url')
      navigate(`/auth?error=${encodeURIComponent(msg)}`, { replace: true })
    }

    // The provider reported a problem, or sent no code at all.
    if (!code) {
      fail(params.get('error_description') || 'Sign-in was cancelled or denied.')
      return
    }

    // `state` is `provider:nonce:issuedAt:hmac`. The first field names the
    // provider; the server re-verifies the whole value before using the code.
    const provider = state.split(':')[0]
    if (provider !== 'github' && provider !== 'google') {
      fail('Sign-in response was not recognised.')
      return
    }

    const isPopup =
      window.opener !== null ||
      window.name === 'google_auth' ||
      window.name === 'github_auth' ||
      window.innerWidth < 650

    handleOAuthCallback(provider, code, state, email, name)
      .then(() => {
        const target = localStorage.getItem('auth_redirect_url') || '/'
        const { user, token } = useAuthStore.getState()
        const payload = { type: 'oauth_complete', provider, target, user, token }

        // 1. BroadcastChannel — survives a COOP-severed opener
        try {
          const channel = new BroadcastChannel('archon_oauth_channel')
          channel.postMessage(payload)
          setTimeout(() => {
            try { channel.close() } catch { /* already closed */ }
          }, 1000)
        } catch { /* unavailable — the other channels still carry it */ }

        // 2. storage event — cross-window fallback
        try {
          localStorage.setItem('archon_oauth_event', JSON.stringify({ ...payload, timestamp: Date.now() }))
        } catch { /* storage full or blocked */ }

        // 3. postMessage — only when the opener is reachable
        if (window.opener) {
          try { window.opener.postMessage(payload, window.location.origin) } catch { /* severed */ }
        }

        if (isPopup) {
          // Close; the opener already navigated itself on receipt.
          setTimeout(() => {
            try { window.close() } catch { /* browser refused the close */ }
          }, 400)
        } else {
          localStorage.removeItem('auth_redirect_url')
          navigate(target, { replace: true })
        }
      })
      .catch((err: unknown) => {
        const msg = messageOf(err)
        // Tell a waiting opener too, so it can clear its loading state.
        if (window.opener) {
          try {
            window.opener.postMessage({ type: 'oauth_error', message: msg }, window.location.origin)
          } catch { /* severed */ }
        }
        fail(msg)
      })
  }, [code, state, email, name, handleOAuthCallback, navigate, params])

  // Only ever visible for the moment the exchange takes, or if this tab was
  // opened directly with no waiting opener and the redirect is in flight.
  return (
    <>
      <Substrate />
      <div className="relative z-[2] flex min-h-screen items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin-mark text-emerald" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
          </svg>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
            Completing sign-in
          </span>
        </div>
      </div>
    </>
  )
}
