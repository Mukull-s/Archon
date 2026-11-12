import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import DocsPage from './pages/DocsPage'
import AuthPage from './pages/AuthPage'
import AuthCallback from './pages/AuthCallback'
import EmailVerify from './pages/EmailVerify'
import DashboardIndex from './pages/DashboardIndex'
import Dashboard from './pages/Dashboard'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/Profile'
import NotFoundPage from './pages/NotFoundPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { useAuthStore } from './stores/authStore'
import './index.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Reset the scroll position on every route change.
 *
 * Without this the browser keeps the previous page's scroll offset, so a link
 * clicked halfway down one page opens the next page halfway down — the reader
 * lands in the middle of a document they have not seen. Anchors (`#section`)
 * are left alone so deep links into the docs still work.
 */
function ScrollReset() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, hash])
  return null
}

/**
 * Smooth scrolling, but only where it belongs.
 *
 * Lenis replaces the wheel handler for the whole document. That is a design
 * choice on the marketing page, where the long scroll is part of the pitch —
 * but inside the product it is a bug: every panel, rail and transcript in the
 * app has its own scroll, and a global wheel interceptor means scrolling over
 * one of those moves the page behind it instead. That is exactly what was
 * happening to the docs sidebars.
 *
 * So Lenis now runs on `/` and nowhere else. Everything else uses the browser's
 * native scrolling, which is what a dense tool should do anyway — native scroll
 * is faster, respects the OS settings, and does not fight nested containers.
 */
function SmoothScrollGate() {
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

  useEffect(() => {
    if (!onLanding) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    })

    const rafCallback = (time: number) => {
      lenis.raf(time * 1000)
    }

    if (typeof gsap?.ticker?.add === 'function') {
      gsap.ticker.add(rafCallback)
    }

    try {
      if (typeof (gsap as { ticker?: { lagSmoothing?: (n: number) => void } })?.ticker?.lagSmoothing === 'function') {
        ;(gsap as unknown as { ticker: { lagSmoothing: (n: number) => void } }).ticker.lagSmoothing(0)
      }
    } catch {
      /* lagSmoothing is optional; a missing implementation is not an error */
    }

    ;(window as unknown as { lenis?: Lenis }).lenis = lenis

    return () => {
      delete (window as unknown as { lenis?: Lenis }).lenis
      lenis.destroy()
      try {
        if (typeof gsap?.ticker?.remove === 'function') {
          gsap.ticker.remove(rafCallback)
        }
      } catch {
        /* ticker already torn down */
      }
      try {
        ScrollTrigger.getAll().forEach((t) => t.kill())
      } catch {
        /* no triggers registered */
      }
    }
  }, [onLanding])

  return null
}

function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <BrowserRouter>
      <ScrollReset />
      <SmoothScrollGate />
      <Toaster
        position="top-right"
        theme="light"
        toastOptions={{
          style: {
            background: '#faf8f2',
            border: '1px solid #d8d3c5',
            color: '#15161a',
            fontFamily: "'Instrument Sans', system-ui, sans-serif",
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/verify" element={<EmailVerify />} />

        {/* Protected Application Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/:id"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        {/* Settings merged into the account page — there is one account, so
            there is one place to manage it. Kept as a redirect so existing
            links and bookmarks keep working. */}
        <Route path="/settings" element={<Navigate to="/profile" replace />} />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App