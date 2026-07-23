import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

interface NavLink {
  label: string
  href: string
  type: 'anchor' | 'route'
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  const { user, isAuthenticated, logout } = useAuthStore()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
        maxWidth: '1120px', margin: '0 auto', padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo Monogram */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/Archonlogo.png" alt="Archon Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Archon
          </span>
        </Link>

        {/* Center nav */}
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px', padding: '4px',
            background: scrolled ? 'rgba(255,255,255,0.03)' : 'transparent',
            border: scrolled ? '1px solid var(--border)' : '1px solid transparent',
            borderRadius: '100px', transition: 'all 0.3s',
          }}>
            {navLinks.map((link) => (
              link.type === 'route' ? (
                <Link key={link.label} to={link.href} style={{
                  background: 'transparent', border: 'none',
                  color: location.pathname === link.href ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)',
                  cursor: 'pointer', padding: '6px 14px', borderRadius: '100px',
                  transition: 'color 0.2s', letterSpacing: '-0.01em', textDecoration: 'none',
                }}>
                  {link.label}
                </Link>
              ) : (
                <button key={link.label} onClick={() => scrollToAnchor(link.href)} style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: '6px 14px',
                  borderRadius: '100px', transition: 'color 0.2s', letterSpacing: '-0.01em',
                }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.color = 'var(--text-secondary)'}
                >
                  {link.label}
                </button>
              )
            ))}
          </div>
        )}

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isAuthenticated && user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '100px', padding: '4px 12px 4px 4px',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(176,38,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || user.email}
                    style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid rgba(176,38,255,0.3)' }}
                  />
                ) : (
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: 'var(--grad-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#fff',
                  }}>
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                  {user.name || user.email.split('@')[0]}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{
                  color: 'var(--text-muted)', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
                }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '180px',
                      background: 'rgba(15, 10, 25, 0.98)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '12px', padding: '6px',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)', zIndex: 100,
                    }}
                  >
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{user.name || user.email.split('@')[0]}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{user.email}</div>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px',
                        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '2px 8px', borderRadius: '100px',
                        background: user.provider === 'github' ? 'rgba(255,255,255,0.06)' : user.provider === 'google' ? 'rgba(66,133,244,0.1)' : 'rgba(176,38,255,0.1)',
                        color: user.provider === 'github' ? 'var(--text-secondary)' : user.provider === 'google' ? '#4285F4' : 'var(--accent)',
                      }}>
                        {user.provider}
                      </div>
                    </div>

                    <Link to="/profile" onClick={() => setMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', borderRadius: '8px',
                        color: 'var(--text-secondary)', fontSize: '13px',
                        textDecoration: 'none', transition: 'background 0.15s',
                        marginBottom: '4px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      My Profile
                    </Link>

                    {user.githubLogin && (
                      <a href={`https://github.com/${user.githubLogin}`} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 12px', borderRadius: '8px',
                          color: 'var(--text-secondary)', fontSize: '13px',
                          textDecoration: 'none', transition: 'background 0.15s',
                          marginBottom: '4px',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
                          <path d="M9 18c-4.51 2-5-2-7-2"/>
                        </svg>
                        GitHub Profile
                      </a>
                    )}

                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                        background: 'transparent', border: 'none', color: '#ef4444',
                        fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'var(--font-sans)', transition: 'background 0.15s',
                        borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate('/auth')} style={{ padding: '7px 16px', fontSize: '13px' }}>
                Sign In
              </button>
              <button className="btn-primary" onClick={() => navigate('/auth')} style={{ padding: '7px 16px', fontSize: '13px' }}>
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  )
}
