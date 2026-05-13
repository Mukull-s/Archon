import React, { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/* ── Animated counter hook ── */
function useCounter(end: string, duration: number = 2000, inView: boolean = false): string {
  const [count, setCount] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current) return
    started.current = true

    const cleaned = end.replace(/[^0-9.]/g, '')
    const target = parseFloat(cleaned) || 0

    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(target * eased * 10) / 10)

      if (progress < 1) requestAnimationFrame(animate)
      else setCount(target)
    }

    requestAnimationFrame(animate)
  }, [inView, end, duration])

  const suffix = end.replace(/[0-9.]/g, '')
  const prefix = end.startsWith('<') ? '<' : ''
  const cleanSuffix = suffix.replace('<', '')
  const displayNum = Number.isInteger(count) ? count.toString() : count.toFixed(1)

  return `${prefix}${displayNum}${cleanSuffix}`
}

interface Stat {
  number: string
  label: string
}

const STATS: Stat[] = [
  { number: '500+', label: 'Repos analyzed' },
  { number: '2.1k+', label: 'Files processed' },
  { number: '<30s', label: 'Avg. analysis time' },
  { number: '98%', label: 'Query accuracy' },
]

interface StatValueProps {
  stat: Stat
  inView: boolean
}

function StatValue({ stat, inView }: StatValueProps) {
  const displayValue = useCounter(stat.number, 1800, inView)
  return <>{displayValue}</>
}

export default function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (gridRef.current) {
        ScrollTrigger.create({
          trigger: gridRef.current, start: 'top 75%',
          onEnter: () => setInView(true), once: true,
        })
      }

      cardsRef.current.forEach((card, i) => {
        if (!card) return
        gsap.from(card, {
          y: 40, opacity: 0, scale: 0.95, ease: 'power2.out',
          scrollTrigger: { trigger: gridRef.current, start: 'top 80%', end: 'top 50%', scrub: 0.5 },
          delay: i * 0.05,
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="section" style={{ padding: '100px 0' }} ref={sectionRef}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(235,235,245,0.3)',
            letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Built for scale</p>
        </div>

        <div ref={gridRef} style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px',
          background: 'var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        }}>
          {STATS.map((stat, i) => (
            <div key={stat.label} ref={el => { cardsRef.current[i] = el }}
              style={{ background: 'var(--bg-secondary)', padding: '44px 32px', textAlign: 'center' }}>
              <div className="stat-number" style={{ marginBottom: '8px' }}>
                <StatValue stat={stat} inView={inView} />
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(235,235,245,0.3)', letterSpacing: '0.02em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
