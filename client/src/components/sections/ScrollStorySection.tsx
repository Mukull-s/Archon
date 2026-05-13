import React, { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

interface TerminalLine {
  text: string
  color: string
}

interface Step {
  num: string
  title: string
  desc: string
  icon: string
  lines: TerminalLine[]
}

const STEPS: Step[] = [
  {
    num: '01', title: 'Paste any GitHub URL', icon: '🔗',
    desc: 'Drop any public repository link. Archon immediately begins reading every file — code, configs, docs, everything.',
    lines: [
      { text: '$ archon analyze github.com/vercel/next.js', color: '#7B748A' },
      { text: '  Resolving repository...', color: '#B8B1C7' },
      { text: '  Authenticating with GitHub API...', color: '#B8B1C7' },
      { text: '  ✓ Repository found: vercel/next.js', color: '#22c55e' },
      { text: '  ✓ 2,847 files detected', color: '#22c55e' },
    ],
  },
  {
    num: '02', title: 'AI reads every file', icon: '📄',
    desc: 'The pipeline ingests the full codebase, splits it into smart chunks, and generates semantic embeddings.',
    lines: [
      { text: '$ Starting ingestion pipeline...', color: '#7B748A' },
      { text: '  Scanning directories: /src /lib /packages', color: '#B8B1C7' },
      { text: '  Chunking 2,847 files → 14,392 segments', color: '#B8B1C7' },
      { text: '  Generating embeddings ████████████░░ 78%', color: '#C15CFF' },
      { text: '  Processing: middleware.ts → auth.ts → api/', color: '#B8B1C7' },
    ],
  },
  {
    num: '03', title: 'Knowledge graph built', icon: '🕸️',
    desc: 'A live vector knowledge base connects functions, modules, and patterns into an AI-navigable map.',
    lines: [
      { text: '  Building dependency graph...', color: '#B8B1C7' },
      { text: '  Mapping: 847 modules, 3,291 connections', color: '#B8B1C7' },
      { text: '  Indexing function signatures...', color: '#B8B1C7' },
      { text: '  ✓ Vector store initialized (FAISS)', color: '#22c55e' },
      { text: '  ✓ Knowledge graph ready — 14,392 nodes', color: '#22c55e' },
    ],
  },
  {
    num: '04', title: 'Ask anything', icon: '⚡',
    desc: 'Chat, trace features, view architecture diagrams — your AI codebase expert is ready.',
    lines: [
      { text: '> How does authentication work?', color: '#C15CFF' },
      { text: '', color: '' },
      { text: '  Auth flow starts at middleware.ts:42', color: '#B8B1C7' },
      { text: '  → verifySession() in lib/auth.ts:18', color: '#D98CFF' },
      { text: '  → JWT validation via jose (RS256)', color: '#D98CFF' },
      { text: '  → redirect handler: next/navigation', color: '#D98CFF' },
    ],
  },
]

export default function ScrollStorySection() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinnedRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])
  const barsRef = useRef<(HTMLDivElement | null)[]>([])
  const dotsRef = useRef<(HTMLDivElement | null)[]>([])
  const termLinesRef = useRef<(HTMLDivElement | null)[][]>([])

  useEffect(() => {
    const section = sectionRef.current
    const pinned = pinnedRef.current
    if (!section || !pinned) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      const N = STEPS.length

      STEPS.forEach((step, i) => {
        const stepEl = stepsRef.current[i]
        const bar = barsRef.current[i]
        const dot = dotsRef.current[i]
        const lines = termLinesRef.current[i] || []
        if (!stepEl) return

        tl.to(stepEl, { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out' }, i === 0 ? 0 : '>-0.05')
        if (bar) tl.to(bar, { scaleY: 1, duration: 0.2 }, '<')
        if (dot) tl.to(dot, { scale: 1.4, opacity: 1, duration: 0.15 }, '<')

        lines.forEach((line, li) => {
          if (line) {
            tl.to(line, { opacity: 1, y: 0, duration: 0.12, ease: 'power1.out' }, li === 0 ? '<+=0.05' : '>-0.02')
          }
        })

        tl.to(stepEl, { duration: 0.3 })

        if (i < N - 1) {
          tl.to(stepEl, { opacity: 0.12, x: -6, duration: 0.2 })
          if (bar) tl.to(bar, { scaleY: 0, duration: 0.15 }, '<')
          if (dot) tl.to(dot, { scale: 0.5, opacity: 0.15, duration: 0.12 }, '<')
          lines.forEach((line) => { if (line) tl.to(line, { opacity: 0, y: -8, duration: 0.08 }, '<') })
        }
      })

      ScrollTrigger.create({
        trigger: section, pin: pinned, start: 'top top',
        end: `+=${window.innerHeight * 2}`, scrub: 1, animation: tl, pinSpacing: true,
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section id="how-it-works" ref={sectionRef} style={{ position: 'relative' }}>
      <div ref={pinnedRef} style={{
        height: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 50% at 25% 50%, rgba(109,40,217,0.04) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 75% 50%, rgba(176,38,255,0.025) 0%, transparent 60%)' }} />

        <div className="container" style={{ position: 'relative', width: '100%' }}>
          <div style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ height: '1px', width: '32px', background: 'rgba(176,38,255,0.3)' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--accent-light)' }}>How It Works</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '56px', alignItems: 'start' }}>
            <div style={{ position: 'relative', paddingLeft: '20px' }}>
              {STEPS.map((step, i) => (
                <div key={step.num} ref={el => { stepsRef.current[i] = el }}
                  style={{ opacity: i === 0 ? 1 : 0.12, transform: i === 0 ? 'translateX(0)' : 'translateX(-6px)',
                    display: 'flex', gap: '14px', padding: '16px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.03)', position: 'relative' }}>
                  <div ref={el => { barsRef.current[i] = el }}
                    style={{ position: 'absolute', left: '-18px', top: '16px', bottom: '16px', width: '2px', borderRadius: '2px',
                      background: 'linear-gradient(180deg, var(--accent), var(--accent-light))',
                      transformOrigin: 'top', transform: i === 0 ? 'scaleY(1)' : 'scaleY(0)' }} />
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(176,38,255,0.05)', border: '1px solid rgba(176,38,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                    {step.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: 'var(--accent-light)', opacity: 0.5, marginBottom: '2px' }}>Step {step.num}</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff',
                      letterSpacing: '-0.02em', marginBottom: '3px', lineHeight: 1.3 }}>{step.title}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)',
                      lineHeight: 1.5, maxWidth: '280px' }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(6,1,11,0.9)', border: '1px solid rgba(176,38,255,0.08)',
              borderRadius: '16px', overflow: 'hidden', position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(176,38,255,0.03)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, var(--accent), var(--accent-light), transparent)' }} />
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'center', gap: '6px' }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.5 }} />
                ))}
                <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)' }}>archon — terminal</span>
              </div>
              <div style={{ position: 'relative', padding: '18px 16px', minHeight: '220px' }}>
                {STEPS.map((step, si) => (
                  <div key={step.num} style={{
                    position: si === 0 ? 'relative' : 'absolute',
                    top: si === 0 ? undefined : '18px', left: si === 0 ? undefined : '16px',
                    right: si === 0 ? undefined : '16px' }}>
                    {step.lines.map((line, li) => (
                      <div key={li} ref={el => {
                        if (!termLinesRef.current[si]) termLinesRef.current[si] = []
                        termLinesRef.current[si][li] = el
                      }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: 1.85,
                          color: line.color || '#B8B1C7', opacity: si === 0 ? 1 : 0,
                          transform: si === 0 ? 'translateY(0)' : 'translateY(6px)',
                          minHeight: line.text ? undefined : '1.85em' }}>
                        {line.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: '28px', top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {STEPS.map((_, i) => (
            <div key={i} ref={el => { dotsRef.current[i] = el }}
              style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-light)',
                transform: i === 0 ? 'scale(1.4)' : 'scale(0.5)', opacity: i === 0 ? 1 : 0.15 }} />
          ))}
        </div>
      </div>
    </section>
  )
}
