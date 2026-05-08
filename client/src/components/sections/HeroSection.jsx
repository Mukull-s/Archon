import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import LightPillar from '../backgrounds/LightPillars'

/* ── Word-by-word stagger reveal ── */
function RevealText({ text, delay = 0, style = {} }) {
  const words = text.split(' ')
  return (
    <span style={{ display: 'inline', ...style }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              delay: delay + i * 0.06,
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {i < words.length - 1 && '\u00A0'}
        </span>
      ))}
    </span>
  )
}

export default function HeroSection() {
  const [repoUrl, setRepoUrl] = useState('')
  const [focused, setFocused] = useState(false)
  const sectionRef = useRef(null)
  const headlineRef = useRef(null)
  const subtextRef = useRef(null)
  const inputRef = useRef(null)
  const socialRef = useRef(null)
  const bgRef = useRef(null)

  /* ── GSAP Parallax — each layer moves at different speed ── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Headline — moves fastest (deepest parallax)
      gsap.to(headlineRef.current, {
        y: -200, scale: 0.88, opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.8,
        },
      })

      // Subtext — medium speed
      gsap.to(subtextRef.current, {
        y: -120, opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '80% top',
          scrub: 0.6,
        },
      })

      // Input — slowest content (closest to viewer)
      gsap.to(inputRef.current, {
        y: -60, opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '70% top',
          scrub: 0.5,
        },
      })

      // Social proof
      gsap.to(socialRef.current, {
        y: -30, opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '60% top',
          scrub: 0.4,
        },
      })

      // Background — scales up slowly (opposite direction feel)
      gsap.to(bgRef.current, {
        scale: 1.15,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  const handleAnalyze = () => {
    if (!repoUrl.trim()) return
    console.log('Analyzing:', repoUrl)
  }

  return (
    <section
      id="hero"
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '100px 24px 60px',
      }}
    >
      {/* ━━━ LIGHT PILLAR ━━━ */}
      <div ref={bgRef} style={{
        position: 'absolute', inset: 0, zIndex: 0,
        willChange: 'transform',
      }}>
        <LightPillar
          topColor="#B026FF"
          bottomColor="#D98CFF"
          intensity={1.2}
          rotationSpeed={0.25}
          glowAmount={0.003}
          pillarWidth={3}
          pillarHeight={0.4}
          noiseIntensity={0.4}
          pillarRotation={20}
          interactive={true}
          mixBlendMode="screen"
          quality="high"
        />
      </div>

      {/* Fade-out bottom gradient */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '220px',
        background: 'linear-gradient(to bottom, transparent, var(--bg-primary))',
        zIndex: 1, pointerEvents: 'none',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse at center, transparent 25%, rgba(6,6,9,0.65) 75%)',
        pointerEvents: 'none',
      }} />

      {/* ━━━ Content — each element has its own GSAP parallax speed ━━━ */}
      <div style={{
        position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '760px',
      }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}
        >
          <div ref={socialRef}>
            <span className="badge">
              <span className="badge-dot" />
              Now in Beta
            </span>
          </div>
        </motion.div>

        {/* Headline — deepest parallax */}
        <div ref={headlineRef} style={{ willChange: 'transform' }}>
          <h1 style={{
            fontSize: 'clamp(42px, 7vw, 72px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.04em',
            marginBottom: '20px',
            color: '#ffffff',
          }}>
            <RevealText text="Your AI" delay={0.25} />
            {' '}
            <span className="text-gradient" style={{ display: 'inline' }}>
              <RevealText text="Codebase" delay={0.4} />
            </span>
            <br />
            <RevealText text="Co-Pilot" delay={0.55} />
          </h1>
        </div>

        {/* Subtext — medium parallax */}
        <div ref={subtextRef} style={{ willChange: 'transform' }}>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <span style={{
              fontSize: 'clamp(15px, 2vw, 17px)',
              color: 'rgba(235,235,245,0.65)',
              lineHeight: 1.65,
              display: 'block',
              maxWidth: '520px',
              margin: '0 auto 40px',
              letterSpacing: '-0.01em',
            }}>
              Paste a GitHub link. Archon ingests the entire repository,
              builds a knowledge graph, and becomes an expert you can ask anything.
            </span>
          </motion.p>
        </div>

        {/* Input — shallow parallax */}
        <div ref={inputRef} style={{ willChange: 'transform' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}
          >
            <div
              className="repo-input-wrapper"
              style={{
                boxShadow: focused
                  ? '0 0 0 3px rgba(176,38,255,0.12), 0 0 40px rgba(176,38,255,0.2)'
                  : 'var(--shadow-md)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: 'rgba(235,235,245,0.4)' }}>
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 18c-4.51 2-5-2-7-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                className="repo-input"
                type="text"
                placeholder="github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              />
              <button
                className="btn-primary"
                onClick={handleAnalyze}
                style={{ borderRadius: '10px', padding: '8px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                Analyze
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Try links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}
          >
            <span style={{ fontSize: '12px', color: 'rgba(235,235,245,0.4)', alignSelf: 'center' }}>Try:</span>
            {['vercel/next.js', 'facebook/react', 'microsoft/vscode'].map((repo) => (
              <button
                key={repo}
                onClick={() => setRepoUrl(`github.com/${repo}`)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '100px', padding: '4px 12px',
                  color: 'rgba(235,235,245,0.7)', fontSize: '12px',
                  fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = 'rgba(176,38,255,0.4)'
                  e.target.style.color = '#D98CFF'
                  e.target.style.background = 'rgba(176,38,255,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.target.style.color = 'rgba(235,235,245,0.7)'
                  e.target.style.background = 'rgba(255,255,255,0.06)'
                }}
              >
                {repo}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
            fontSize: '12px', color: 'rgba(235,235,245,0.4)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              500+ repos analyzed
            </span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span>Open source</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span>Free to use</span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 1.3, duration: 0.6 }}
        style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}
      >
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'rgba(235,235,245,0.5)' }}>
            <path d="M12 5v14M19 12l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
      </motion.div>
    </section>
  )
}
