import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'

interface NavLink {
  label: string
  href: string
  type: 'anchor' | 'route'
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks: NavLink[] = [
    { label: 'Features', href: '#features', type: 'anchor' },
    { label: 'How It Works', href: '#how-it-works', type: 'anchor' },
    { label: 'Pricing', href: '/pricing', type: 'route' },
    { label: 'Docs', href: '#', type: 'anchor' },
  ]

  const scrollToAnchor = (href: string) => {
    if (location.pathname !== '/') {
      window.location.href = '/' + href
      return
    }
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'var(--grad-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{
            fontWeight: 700, fontSize: '16px',
            color: 'var(--text-primary)', letterSpacing: '-0.03em',
          }}>
            Archon
          </span>
        </Link>

        {/* Center nav */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px',
          padding: '4px',
          background: scrolled ? 'rgba(255,255,255,0.03)' : 'transparent',
          border: scrolled ? '1px solid var(--border)' : '1px solid transparent',
          borderRadius: '100px', transition: 'all 0.3s',
        }}>
          {navLinks.map((link) => (
            link.type === 'route' ? (
              <Link
                key={link.label}
                to={link.href}
                style={{
                  background: 'transparent', border: 'none',
                  color: location.pathname === link.href ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  padding: '6px 14px', borderRadius: '100px',
                  transition: 'color 0.2s', letterSpacing: '-0.01em',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
            ) : (
              <button
                key={link.label}
                onClick={() => scrollToAnchor(link.href)}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-secondary)', fontSize: '13px',
                  fontWeight: 500, fontFamily: 'var(--font-sans)',
                  cursor: 'pointer', padding: '6px 14px',
                  borderRadius: '100px', transition: 'color 0.2s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = 'var(--text-secondary)'}
              >
                {link.label}
              </button>
            )
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-ghost" style={{ padding: '7px 16px', fontSize: '13px' }}>
            Sign In
          </button>
          <button className="btn-primary" style={{ padding: '7px 16px', fontSize: '13px' }}>
            Get Started
          </button>
        </div>
      </div>
    </motion.nav>
  )
}
