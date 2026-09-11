import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from './ui/DesignSystem';

interface NavLink {
  label: string;
  href: string;
  type: 'anchor' | 'route';
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const { user, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const navLinks: NavLink[] = [
    { label: 'Features', href: '#features', type: 'anchor' },
    { label: 'How It Works', href: '#how-it-works', type: 'anchor' },
    { label: 'Pricing', href: '/pricing', type: 'route' },
    { label: 'Docs', href: '/docs', type: 'route' },
  ];

  const scrollToAnchor = (href: string) => {
    if (location.pathname !== '/') {
      window.location.href = '/' + href;
      return;
    }
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Logo Monogram */}
        <Link
          to="/"
          className="flex items-center gap-2 no-underline text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
        >
          <img src="/Archonlogo.png" alt="Archon Logo" className="w-7 h-7 object-contain" />
          <span className="font-heading font-bold text-base text-text-primary tracking-tight">
            Archon
          </span>
        </Link>

        {/* Center nav */}
        {!isMobile && (
          <div
            className={`flex items-center gap-0.5 p-1 rounded-full transition-all duration-300 ${
              scrolled
                ? 'bg-surface-base/40 border border-border-subtle backdrop-blur-md'
                : 'bg-transparent border border-transparent'
            }`}
          >
            {navLinks.map((link) => (
              link.type === 'route' ? (
                <Link
                  key={link.label}
                  to={link.href}
                  className={`text-[13px] font-medium py-1.5 px-3.5 rounded-full transition-colors duration-200 no-underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    location.pathname === link.href
                      ? 'text-text-primary bg-surface-elevated/40'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => scrollToAnchor(link.href)}
                  className="bg-transparent border-0 text-text-secondary hover:text-text-primary text-[13px] font-medium py-1.5 px-3.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {link.label}
                </button>
              )
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="User account menu"
                className="flex items-center gap-2 h-9 pl-1 pr-3 py-1 rounded-full bg-surface-base/80 hover:bg-surface-elevated/90 border border-border-subtle/80 hover:border-accent/40 shadow-sm backdrop-blur-md transition-all duration-200 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || user.email}
                    className="w-7 h-7 rounded-full shrink-0 aspect-square object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full shrink-0 aspect-square bg-gradient-to-br from-accent via-accent to-accent-hover text-white flex items-center justify-center text-xs font-semibold ring-1 ring-white/15 shadow-inner">
                    {(user.name || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-medium text-text-primary group-hover:text-white transition-colors max-w-[120px] truncate tracking-tight">
                  {user.name || user.email.split('@')[0]}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`text-text-muted group-hover:text-text-secondary transition-transform duration-200 ${menuOpen ? 'rotate-180 text-accent' : 'rotate-0'}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    role="menu"
                    aria-label="User navigation"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-[calc(100%+8px)] right-0 w-60 bg-surface-base/95 backdrop-blur-2xl border border-border-subtle/90 rounded-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_1px_1px_rgba(255,255,255,0.06)] z-50"
                  >
                    {/* User profile header card */}
                    <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border-subtle/50 mb-1">
                      <div className="text-xs font-semibold text-text-primary truncate tracking-tight">
                        {user.name || user.email.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-text-muted truncate mt-0.5">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide uppercase bg-accent/10 text-accent border border-accent/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          {user.provider || 'Archon'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <Link
                        to="/dashboard"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all duration-150 group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex items-center gap-2.5">
                          <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="9" />
                            <rect x="14" y="3" width="7" height="5" />
                            <rect x="14" y="12" width="7" height="9" />
                            <rect x="3" y="16" width="7" height="5" />
                          </svg>
                          <span>Dashboard</span>
                        </span>
                        <svg className="w-3.5 h-3.5 text-text-muted/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      <Link
                        to="/history"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all duration-150 group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex items-center gap-2.5">
                          <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span>My Repositories</span>
                        </span>
                        <svg className="w-3.5 h-3.5 text-text-muted/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      <Link
                        to="/profile"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all duration-150 group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex items-center gap-2.5">
                          <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>My Profile</span>
                        </span>
                        <svg className="w-3.5 h-3.5 text-text-muted/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      <Link
                        to="/settings"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all duration-150 group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex items-center gap-2.5">
                          <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          <span>Settings</span>
                        </span>
                        <svg className="w-3.5 h-3.5 text-text-muted/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>

                      {user.githubLogin && (
                        <a
                          href={`https://github.com/${user.githubLogin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-elevated/70 transition-all duration-150 group no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <span className="flex items-center gap-2.5">
                            <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                              <path d="M9 18c-4.51 2-5-2-7-2" />
                            </svg>
                            <span>GitHub Profile</span>
                          </span>
                          <svg className="w-3.5 h-3.5 text-text-muted/40 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>

                    <div className="my-1 mx-1 h-px bg-border-subtle/50" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-xs font-medium text-status-error/90 hover:text-status-error hover:bg-status-error/10 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-error text-left group"
                    >
                      <svg className="w-3.5 h-3.5 text-status-error/70 group-hover:text-status-error transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/auth')}
              >
                Get Started
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
