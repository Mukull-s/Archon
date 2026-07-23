import { useEffect, useRef } from 'react'

interface MousePos {
  x: number
  y: number
}

export default function CinematicCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const mouse = useRef<MousePos>({ x: -100, y: -100 })
  const ring = useRef<MousePos>({ x: -100, y: -100 })
  const raf = useRef<number | null>(null)

  useEffect(() => {
    // Hide on touch devices
    if ('ontouchstart' in window) return

    const dot = dotRef.current
    const ringEl = ringRef.current
    if (!dot || !ringEl) return

    document.body.classList.add('custom-cursor-active')

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
      // Dot follows instantly
      dot.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 3}px)`
    }

    const onEnterInteractive = () => {
      dot.style.transform += ' scale(0.5)'
      ringEl.style.width = '44px'
      ringEl.style.height = '44px'
      ringEl.style.opacity = '0.5'
    }

    const onLeaveInteractive = () => {
      ringEl.style.width = '32px'
      ringEl.style.height = '32px'
      ringEl.style.opacity = '0.35'
    }

    // Lerp loop for the ring
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const animate = () => {
      ring.current.x = lerp(ring.current.x, mouse.current.x, 0.12)
      ring.current.y = lerp(ring.current.y, mouse.current.y, 0.12)
      ringEl.style.transform = `translate(${ring.current.x - 16}px, ${ring.current.y - 16}px)`
      raf.current = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', onMove)
    raf.current = requestAnimationFrame(animate)

    // Add hover detection for interactive elements
    const interactives = document.querySelectorAll('a, button, input, [data-cursor]')
    interactives.forEach((el) => {
      el.addEventListener('mouseenter', onEnterInteractive)
      el.addEventListener('mouseleave', onLeaveInteractive)
    })

    // Re-detect interactive elements periodically (for dynamic content)
    const observer = new MutationObserver(() => {
      const els = document.querySelectorAll('a, button, input, [data-cursor]')
      els.forEach((el) => {
        el.removeEventListener('mouseenter', onEnterInteractive)
        el.removeEventListener('mouseleave', onLeaveInteractive)
        el.addEventListener('mouseenter', onEnterInteractive)
        el.addEventListener('mouseleave', onLeaveInteractive)
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.body.classList.remove('custom-cursor-active')
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
      observer.disconnect()
      interactives.forEach((el) => {
        el.removeEventListener('mouseenter', onEnterInteractive)
        el.removeEventListener('mouseleave', onLeaveInteractive)
      })
    }
  }, [])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null

  return (
    <>
      {/* Inner dot — instant tracking */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '6px', height: '6px',
          borderRadius: '50%',
          background: '#D98CFF',
          pointerEvents: 'none',
          zIndex: 99999,
          transition: 'transform 0.05s ease',
          mixBlendMode: 'difference',
        }}
      />
      {/* Outer ring — lerp-lagged tracking with glow */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '32px', height: '32px',
          borderRadius: '50%',
          border: '1px solid rgba(176, 38, 255, 0.3)',
          pointerEvents: 'none',
          zIndex: 99998,
          opacity: 0.35,
          boxShadow: '0 0 12px rgba(176, 38, 255, 0.15)',
          transition: 'width 0.3s ease, height 0.3s ease, opacity 0.3s ease',
        }}
      />
    </>
  )
}
