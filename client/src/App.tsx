import { useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Pricing from './pages/Pricing'
import './index.css'

// Register GSAP plugins once
gsap.registerPlugin(ScrollTrigger)

function App() {
  useEffect(() => {
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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
