import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { useAuthStore } from './stores/authStore'
import './index.css'

gsap.registerPlugin(ScrollTrigger)

function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    hydrate()

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
      if (typeof (gsap as any)?.ticker?.lagSmoothing === 'function') {
        (gsap as any).ticker.lagSmoothing(0)
      }
    } catch {
      // Ignore if lagSmoothing is not supported in this environment
    }

    (window as any).lenis = lenis;

    return () => {
      delete (window as any).lenis;
      lenis.destroy()
      try {
        if (typeof gsap?.ticker?.remove === 'function') {
          gsap.ticker.remove(rafCallback)
        }
      } catch {}
      try {
        ScrollTrigger.getAll().forEach(t => t.kill())
      } catch {}
    }
  }, [hydrate])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'rgba(15, 10, 25, 0.95)',
            border: '1px solid rgba(176,38,255,0.15)',
            color: '#fff',
            backdropFilter: 'blur(12px)',
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
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
