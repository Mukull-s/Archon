import React, { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function CTASection() {
  const [repoUrl, setRepoUrl] = useState('')
  const [focused, setFocused] = useState(false)
  const sectionRef = useRef(null)
  const contentRef = useRef(null)
  const glowRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Cinematic "coming into focus" entrance ──
      gsap.from(contentRef.current, {
        scale: 0.85, opacity: 0, filter: 'blur(12px)',
        ease: 'power2.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          end: 'top 40%',
          scrub: 0.8,
        },
      })

      // ── Background glow intensifies on scroll ──
      gsap.from(glowRef.current, {
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          end: 'top 30%',
          scrub: 1,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: '120px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div ref={glowRef} style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 100%, rgba(176,38,255,0.12) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '50%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(176,38,255,0.2), transparent)',
      }} />

      <div ref={contentRef} style={{
        maxWidth: '560px', margin: '0 auto', textAlign: 'center',
        position: 'relative', zIndex: 1,
        willChange: 'transform, opacity, filter',
      }}>
        <h2 style={{
          fontSize: 'clamp(28px, 4vw, 40px)',
          fontWeight: 800, letterSpacing: '-0.03em',
          lineHeight: 1.15, marginBottom: '14px', color: '#ffffff',
        }}>
          Ready to understand{' '}
          <span className="text-gradient">any codebase?</span>
        </h2>

        <p style={{
          fontSize: '15px', color: 'rgba(235,235,245,0.55)',
          marginBottom: '36px', letterSpacing: '-0.01em',
        }}>
          Drop a GitHub URL and get your first analysis free. No sign-up required.
        </p>

        {/* Input */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div
            className="repo-input-wrapper"
            style={{
              maxWidth: '480px',
              boxShadow: focused
                ? '0 0 0 3px rgba(176,38,255,0.1), 0 0 50px rgba(176,38,255,0.2)'
                : 'var(--shadow-lg)',
            }}
          >
            <input
              className="repo-input"
              type="text"
              placeholder="github.com/owner/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <button
              className="btn-primary"
              style={{ borderRadius: '10px', padding: '8px 18px', fontSize: '13px' }}
            >
              Analyze →
            </button>
          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(235,235,245,0.3)' }}>
          Works with any public GitHub repository
        </p>
      </div>
    </section>
  )
}
