import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import AuthCallback from './pages/AuthCallback'
import { useAuthStore } from './stores/authStore'
import './index.css'

// Register GSAP plugins once
gsap.registerPlugin(ScrollTrigger)

function App() {
  const hydrate = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    // Rehydrate auth state from localStorage
    hydrate()

    // ── Lenis smooth scroll, wired into GSAP ticker ──
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.5,
    })

    // Sync Lenis → GSAP so ScrollTrigger reads Lenis's scroll position
    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time: number) => {
      lenis.raf(time * 1000) // Lenis expects ms, GSAP ticker gives seconds
    })
    gsap.ticker.lagSmoothing(0) // Prevent GSAP from throttling on lag

    return () => {
      lenis.destroy()
      gsap.ticker.remove(lenis.raf)
      ScrollTrigger.getAll().forEach(t => t.kill())
    }
  }, [])

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
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
