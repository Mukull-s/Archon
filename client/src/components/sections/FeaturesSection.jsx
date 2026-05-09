import React, { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/* ── 3D Tilt Card (framer-motion hover — works fine, keeping it) ── */
function TiltCard({ children, style = {}, highlighted = false }) {
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ rotateX: -y * 12, rotateY: x * 12 })
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ rotateX: 0, rotateY: 0 })
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
        scale: isHovered ? 1.02 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
        ...style,
      }}
      className="feature-card"
    >
      {/* Shine/glare effect on hover */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit',
        background: isHovered
          ? `radial-gradient(circle at ${(tilt.rotateY / 12 + 0.5) * 100}% ${(-tilt.rotateX / 12 + 0.5) * 100}%, rgba(176,38,255,0.08) 0%, transparent 60%)`
          : 'transparent',
        transition: 'background 0.3s', pointerEvents: 'none', zIndex: 0,
      }} />

      {highlighted && (
        <div style={{
          position: 'absolute', top: '14px', right: '14px',
          background: 'var(--grad-primary)', borderRadius: '100px',
          padding: '2px 8px', fontSize: '9px', fontWeight: 700,
          color: 'white', letterSpacing: '0.04em', textTransform: 'uppercase', zIndex: 2,
        }}>
          Soon
        </div>
      )}

      {children}
    </motion.div>
  )
}

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"/>
      </svg>
    ),
    title: 'Architecture Overview',
    desc: 'Generate an interactive dependency graph showing modules, services, and how they connect across the entire codebase.',
    tag: 'Visualization',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
      </svg>
    ),
    title: 'Feature Flow Tracing',
    desc: 'Ask "How does login work?" and get a step-by-step trace through actual files — showing exactly where each piece lives.',
    tag: 'RAG-powered',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    title: 'Deep File Intelligence',
    desc: 'Every file analyzed — purpose, key functions, complexity score, and a plain-English summary. Know what any file does without opening it.',
    tag: 'AI Analysis',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    title: 'Chat With Your Code',
    desc: 'Ask anything in natural language. Archon retrieves the exact relevant code chunks and answers with full context.',
    tag: 'Context-aware',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    title: 'Learn Any Codebase',
    desc: 'Get a reading guide, key concept breakdowns, and auto-generated questions. Onboard to any codebase 10x faster.',
    tag: 'Onboarding',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M8.5 2.2A10 10 0 0 1 21.8 15.5"/>
      </svg>
    ),
    title: 'Change Impact Radar',
    desc: 'Select any function and see everything it affects across the codebase — visualized as a live ripple map before you touch a line.',
    tag: 'Coming soon',
    highlighted: true,
  },
]

export default function FeaturesSection() {
  const sectionRef = useRef(null)
  const headingRef = useRef(null)
  const cardsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Heading: scale + blur entrance tied to scroll ──
      gsap.from(headingRef.current, {
        y: 60, opacity: 0, scale: 0.95, filter: 'blur(6px)',
        ease: 'power2.out',
        scrollTrigger: {
          trigger: headingRef.current,
          start: 'top 85%',
          end: 'top 50%',
          scrub: 0.8,
        },
      })

      // ── Cards: staggered scroll-driven entrance ──
      cardsRef.current.forEach((card, i) => {
        if (!card) return
        gsap.from(card, {
          y: 80, opacity: 0, scale: 0.92,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 90%',
            end: 'top 60%',
            scrub: 0.6,
          },
        })
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section id="features" className="section" ref={sectionRef}>
      <div className="container">

        {/* Header */}
        <div ref={headingRef} style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <span className="badge">
              <span className="badge-dot" />
              Features
            </span>
          </div>

          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 40px)',
            fontWeight: 800, letterSpacing: '-0.03em',
            lineHeight: 1.15, marginBottom: '12px', color: '#ffffff',
          }}>
            Everything to{' '}
            <span className="text-gradient">master any codebase</span>
          </h2>

          <p style={{
            fontSize: '15px', color: 'rgba(235,235,245,0.55)',
            maxWidth: '460px', margin: '0 auto', letterSpacing: '-0.01em',
          }}>
            From architecture maps to AI chat — tools for understanding, onboarding, and shipping faster.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px', perspective: '1200px',
        }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} ref={el => cardsRef.current[i] = el}>
              <TiltCard
                highlighted={f.highlighted}
                style={f.highlighted ? { borderColor: 'rgba(176,38,255,0.15)', background: 'rgba(176,38,255,0.04)' } : {}}
              >
                <div className="feature-icon" style={{ color: 'var(--accent-light)', position: 'relative', zIndex: 1 }}>
                  {f.icon}
                </div>
                <div style={{
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--accent-light)',
                  marginBottom: '6px', position: 'relative', zIndex: 1, opacity: 0.7,
                }}>
                  {f.tag}
                </div>
                <div className="feature-title" style={{ position: 'relative', zIndex: 1 }}>{f.title}</div>
                <div className="feature-desc" style={{ position: 'relative', zIndex: 1 }}>{f.desc}</div>
              </TiltCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
