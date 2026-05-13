import React, { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Navbar from '../components/Navbar'
import CinematicCursor from '../components/CinematicCursor'
import FAQSection from '../components/sections/FAQSection'
import Footer from '../components/sections/Footer'

interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  period: string
  desc: string
  popular: boolean
  features: PlanFeature[]
  cta: string
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Try Archon on public repos. No credit card required.',
    popular: false,
    features: [
      { text: '3 repositories', included: true },
      { text: '500 files per repo', included: true },
      { text: '20 chat queries / day', included: true },
      { text: 'Basic architecture maps', included: true },
      { text: 'File intelligence', included: true },
      { text: 'Feature flow tracing', included: false },
      { text: 'Team collaboration', included: false },
      { text: 'API access', included: false },
    ],
    cta: 'Get Started Free',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    desc: 'Full power for individual developers and power users.',
    popular: true,
    features: [
      { text: 'Unlimited repositories', included: true },
      { text: '10,000 files per repo', included: true },
      { text: 'Unlimited chat queries', included: true },
      { text: 'Full interactive architecture maps', included: true },
      { text: 'File intelligence', included: true },
      { text: 'Feature flow tracing', included: true },
      { text: 'Auto-generated documentation', included: true },
      { text: 'Priority support', included: false },
    ],
    cta: 'Start Pro Trial',
  },
  {
    name: 'Team',
    price: '$49',
    period: '/month',
    desc: 'Built for engineering teams that move fast.',
    popular: false,
    features: [
      { text: 'Unlimited repositories', included: true },
      { text: 'Unlimited files per repo', included: true },
      { text: 'Unlimited chat queries', included: true },
      { text: 'Full maps + SVG export', included: true },
      { text: 'File intelligence', included: true },
      { text: 'Feature flow tracing', included: true },
      { text: 'Team collaboration & sharing', included: true },
      { text: 'API access + webhooks', included: true },
    ],
    cta: 'Contact Sales',
  },
]

export default function Pricing() {
  const heroRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    window.scrollTo(0, 0)

    const ctx = gsap.context(() => {
      // Hero entrance
      if (heroRef.current) {
        gsap.from(heroRef.current, {
          y: 40, opacity: 0,
          duration: 0.8, ease: 'power2.out', delay: 0.2,
        })
      }

      // Cards staggered entrance
      cardsRef.current.forEach((card, i) => {
        if (!card) return
        gsap.from(card, {
          y: 60, opacity: 0, scale: 0.96,
          duration: 0.7, ease: 'power2.out',
          delay: 0.4 + i * 0.12,
        })
      })
    })

    return () => ctx.revert()
  }, [])

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <CinematicCursor />
      <Navbar />

      {/* Hero */}
      <section style={{
        paddingTop: '140px', paddingBottom: '80px',
        textAlign: 'center', position: 'relative',
      }}>
        {/* Atmospheric glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(176,38,255,0.04) 0%, transparent 60%)',
        }} />

        <div ref={heroRef} style={{ position: 'relative' }}>
          <p style={{
            fontSize: '12px', fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px',
          }}>
            Pricing
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800, letterSpacing: '-0.04em',
            lineHeight: 1.1, color: '#fff', marginBottom: '16px',
          }}>
            Choose your plan
          </h1>
          <p style={{
            fontSize: '16px', color: 'var(--text-secondary)',
            maxWidth: '440px', margin: '0 auto',
            letterSpacing: '-0.01em',
          }}>
            Start free. Upgrade when your codebases demand more.
          </p>
        </div>
      </section>

      {/* Pricing Grid */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: '1040px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px', alignItems: 'start',
        }}>
          {PLANS.map((plan, i) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              ref={(el: HTMLDivElement | null) => { cardsRef.current[i] = el }}
            />
          ))}
        </div>
      </section>

      {/* FAQ */}
      <FAQSection />
      <Footer />
    </div>
  )
}

interface PricingCardProps {
  plan: Plan
}

const PricingCard = React.forwardRef<HTMLDivElement, PricingCardProps>(({ plan }, ref) => {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ scale: hovered ? 1.015 : 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        position: 'relative',
        background: plan.popular
          ? 'linear-gradient(180deg, rgba(176,38,255,0.06) 0%, rgba(6,1,11,0.95) 100%)'
          : 'var(--bg-secondary)',
        border: plan.popular
          ? '1px solid rgba(176,38,255,0.2)'
          : '1px solid rgba(255,255,255,0.05)',
        borderRadius: '20px',
        padding: '36px 28px 32px',
        overflow: 'hidden',
        boxShadow: plan.popular
          ? '0 0 40px rgba(176,38,255,0.08), 0 20px 60px rgba(0,0,0,0.3)'
          : '0 8px 40px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.3s ease',
        ...(hovered && !plan.popular ? { boxShadow: '0 12px 50px rgba(0,0,0,0.3), 0 0 20px rgba(176,38,255,0.05)' } : {}),
      }}
    >
      {/* Top accent for popular */}
      {plan.popular && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--purple-energy), transparent)',
        }} />
      )}

      {/* Popular badge */}
      {plan.popular && (
        <div style={{
          display: 'inline-block',
          background: 'var(--grad-primary)',
          borderRadius: '100px',
          padding: '3px 10px',
          fontSize: '10px', fontWeight: 700,
          color: '#fff', letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '16px',
        }}>
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <div style={{
        fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)',
        marginBottom: '8px', letterSpacing: '-0.01em',
      }}>
        {plan.name}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '42px', fontWeight: 800, color: '#fff',
          letterSpacing: '-0.04em', lineHeight: 1,
        }}>
          {plan.price}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          {plan.period}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '13px', color: 'var(--text-secondary)',
        marginBottom: '24px', lineHeight: 1.5,
      }}>
        {plan.desc}
      </p>

      {/* CTA Button */}
      <button
        className={plan.popular ? 'btn-primary' : 'btn-ghost'}
        style={{
          width: '100%', padding: '10px 0',
          fontSize: '13px', fontWeight: 600,
          borderRadius: '10px', marginBottom: '28px',
        }}
      >
        {plan.cta}
      </button>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {plan.features.map((feat) => (
          <div key={feat.text} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '13px',
            color: feat.included ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}>
            <span style={{
              width: '16px', height: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', flexShrink: 0,
              color: feat.included ? '#22c55e' : 'var(--text-muted)',
              opacity: feat.included ? 1 : 0.4,
            }}>
              {feat.included ? '✓' : '—'}
            </span>
            <span style={{ opacity: feat.included ? 1 : 0.5 }}>{feat.text}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
})

PricingCard.displayName = 'PricingCard'
