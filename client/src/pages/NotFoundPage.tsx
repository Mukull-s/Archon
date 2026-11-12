import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Substrate } from '../components/site/Substrate'

/**
 * 404 — the same instrument paper as the rest of the site.
 *
 * Previously this page was a dark-themed screen built from inline styles and
 * two classes (`btn-primary`, `btn-ghost`) that were defined in no stylesheet,
 * so its buttons rendered unstyled. It is now plain paper with the shared app
 * button styles.
 */
export default function NotFoundPage() {
  const navigate = useNavigate()


  return (
    <>
      <Substrate />
      <div className="relative z-[2] flex min-h-screen flex-col">
        {/* a hairline rail, matching the app surfaces */}
        <div className="arail">
          <div className="mx-auto flex w-full max-w-site items-center justify-between gap-6 px-6 md:px-10">
            <Link to="/" className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.03em] text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-emerald" aria-hidden="true">
                <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1.65" fill="currentColor" />
              </svg>
              Archon
            </Link>
            <Link to="/" className="kbd">
              ← Home
            </Link>
          </div>
        </div>

        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-28 pt-20 text-center">
          <div className="eyebrow eyebrow--em justify-center">Error 404</div>

          <div className="mt-6 text-[96px] font-semibold leading-none tracking-[-0.05em] text-ink">
            404
          </div>

          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-ink">
            This route does not resolve
          </h1>

          <p className="mt-3 max-w-[46ch] text-[14px] leading-[1.65] text-ink-2">
            The page you asked for does not exist, or it has moved. Nothing was lost — pick a
            destination below.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="abtn abtn--solid">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Go back
            </button>
            <Link to="/" className="abtn abtn--ghost">
              Return home
            </Link>
            <Link to="/history" className="abtn abtn--ghost">
              My repositories
            </Link>
            <Link to="/docs" className="abtn abtn--ghost">
              Documentation
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
