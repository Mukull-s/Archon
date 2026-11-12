import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArchonMark } from './Substrate'
import { useAuthStore } from '../../stores/authStore'

/**
 * The site header — one paper rail for the whole product.
 *
 * It serves two jobs that used to be split across two components with two
 * different looks:
 *
 *   • ON THE LANDING PAGE it highlights the section you have scrolled into,
 *     because the page is a document and the nav is a table of contents.
 *
 *   • ON EVERY OTHER PAGE it highlights the route you are on, because those
 *     pages are destinations, not sections.
 *
 * Previously the landing used this paper rail while Pricing, Docs, Profile,
 * Settings and History used a separate dark glass `Navbar`. The result was two
 * different products joined at the footer. One component, one material.
 */

const SECTIONS = [
  { id: 'method', label: 'Method' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'engine', label: 'Engine' },
  { id: 'limits', label: 'Limits' },
] as const

/** Route-level destinations, shown on every page. */
const ROUTES = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/docs', label: 'Docs' },
] as const

export function SiteHeader() {
  const [activeSection, setActiveSection] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()

  const onLanding = location.pathname === '/'

  /* Scroll-spy only makes sense on the landing page. It watches the sections
     that actually exist there rather than guessing from the route. */
  useEffect(() => {
    if (!onLanding) return
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (!els.length || typeof IntersectionObserver === 'undefined') return

    const visible = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        setActiveSection(SECTIONS.find((s) => visible.has(s.id))?.id ?? '')
      },
      { rootMargin: '-72px 0px -62% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [onLanding])

  /* Dismiss the account menu on outside click or Escape. */
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById('site-account-menu')
      const btn = document.getElementById('site-account-button')
      if (el && !el.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const displayName = user?.name || user?.email?.split('@')[0] || 'Account'
  const initial = displayName.charAt(0).toUpperCase()

  const linkClass = (on: boolean) =>
    [
      'relative py-1 text-[13.5px] transition-colors',
      on
        ? 'font-medium text-ink after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5 after:bg-emerald after:content-[""]'
        : 'text-ink-2 hover:text-ink',
    ].join(' ')

  return (
    <header className="sticky top-0 z-[80] border-b border-rule bg-paper/85 backdrop-blur-md backdrop-saturate-150">
      <div className="relative z-[2] mx-auto flex h-[66px] w-full max-w-site items-center gap-7 px-6 md:px-10 lg:px-14">
        <Link
          to="/"
          className="group flex flex-none items-center gap-2.5 text-base font-semibold tracking-[-0.025em]"
        >
          <ArchonMark size={21} className="text-emerald group-hover:animate-spin-mark" />
          Archon
        </Link>

        <nav className="ml-3.5 hidden items-center gap-7 md:flex" aria-label="Sections">
          {onLanding &&
            SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={linkClass(activeSection === s.id)}>
                {s.label}
              </a>
            ))}

          {ROUTES.map((r) => (
            <Link key={r.to} to={r.to} className={linkClass(location.pathname === r.to)}>
              {r.label}
            </Link>
          ))}

          <Link to="/dashboard" className={linkClass(location.pathname.startsWith('/dashboard'))}>
            Dashboard
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden items-center gap-2 whitespace-nowrap rounded-[3px] border-[1.5px] border-forest bg-forest px-[18px] py-[11px] text-[13.5px] font-semibold tracking-[-0.005em] text-[#f0f6f2] transition-colors hover:border-[#0c2a23] hover:bg-[#0c2a23] sm:inline-flex"
              >
                Open dashboard <span className="text-sm opacity-70">→</span>
              </Link>

              <div className="relative">
                <button
                  id="site-account-button"
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="flex items-center gap-2 rounded-full border border-rule-strong bg-paper-2 py-1 pl-1 pr-2.5 transition-colors hover:border-ink-3"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-[11px] font-semibold text-[#f0f6f2]">
                      {initial}
                    </span>
                  )}
                  <span className="hidden max-w-[110px] truncate text-[12.5px] font-medium text-ink sm:block">
                    {displayName}
                  </span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-ink-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    id="site-account-menu"
                    role="menu"
                    aria-label="Account"
                    className="absolute right-0 top-[calc(100%+8px)] z-[90] w-[236px] overflow-hidden border border-rule bg-paper-2 shadow-dossier"
                  >
                    <div className="border-b border-rule bg-paper-3 px-3.5 py-3">
                      <div className="truncate text-[12.5px] font-semibold text-ink">{displayName}</div>
                      <div className="mt-0.5 truncate font-mono text-[10px] text-ink-3">{user.email}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-emerald">
                          {user.provider || 'email'}
                        </span>
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3">
                          · {user.plan === 'pro' ? 'Architect' : 'Explorer'}
                        </span>
                      </div>
                    </div>

                    <div className="p-1">
                      {[
                        { to: '/dashboard', label: 'Dashboard' },
                        { to: '/history', label: 'My repositories' },
                        { to: '/profile', label: 'Profile' },
                        { to: '/settings', label: 'Settings' },
                      ].map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="block px-2.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                        >
                          {item.label}
                        </Link>
                      ))}
                      {user.githubLogin && (
                        <a
                          href={`https://github.com/${user.githubLogin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          role="menuitem"
                          className="block px-2.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                        >
                          GitHub profile
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        logout()
                        navigate('/')
                      }}
                      className="w-full border-t border-rule px-3 py-2.5 text-left text-[12.5px] text-sig transition-colors hover:bg-[rgba(226,70,47,.07)]"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden text-[13.5px] text-ink-2 transition-colors hover:text-ink sm:block"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-[3px] border-[1.5px] border-forest bg-forest px-[18px] py-[11px] text-[13.5px] font-semibold tracking-[-0.005em] text-[#f0f6f2] transition-colors hover:border-[#0c2a23] hover:bg-[#0c2a23]"
              >
                Open Archon <span className="text-sm opacity-70">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
