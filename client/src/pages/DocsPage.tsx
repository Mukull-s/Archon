import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Substrate } from '../components/site/Substrate'
import { SiteHeader } from '../components/site/SiteHeader'
import SiteFooter from '../components/site/SiteFooter'
import { DOC_CATEGORIES, ALL_DOC_PAGES } from '../data/docsContent'
import { DOC_ARTICLES } from '../data/docsArticles'
import DocSearchModal from '../components/docs/DocSearchModal'

/**
 * Documentation.
 *
 * Three columns: every topic on the left, the article in the middle, and the
 * article's own headings on the right with the one you are reading marked.
 *
 * All three are generated from `docsArticles` — the navigation cannot list a
 * page that does not exist, and the table of contents cannot miss a heading the
 * article declares, because both are reading the same source.
 *
 * The article body is written in `docsArticles.tsx` using the doc primitives
 * (DocCodeBlock, DocCallout, DocDiagrams), so prose sits on paper and code sits
 * on a plate. This shell only frames it.
 */

/** Sticky offset shared by both rails — must match the header height. */
const HEADER_H = 66
const RAIL_TOP = HEADER_H + 20
const READING_ANCHOR = HEADER_H + 20

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const pageParam = searchParams.get('page')
  const activePageId = pageParam && DOC_ARTICLES[pageParam] ? pageParam : 'what-is-archon'
  const article = DOC_ARTICLES[activePageId] || DOC_ARTICLES['what-is-archon']

  const [activeSectionId, setActiveSectionId] = useState<string>(() => article.sections[0]?.id || '')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)


  useEffect(() => {
    setActiveSectionId(article.sections[0]?.id || '')
  }, [activePageId, article])

  /* ⌘K / Ctrl+K opens search from anywhere on the page. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      if (e.key === 'Escape') setIsMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Scroll-spy: the heading you are reading is the last one to have passed the
     reading line. Tracking document position rather than intersection ratios
     keeps it correct on very long sections. */
  useEffect(() => {
    const ids = article.sections.map((s) => s.id)
    if (ids.length === 0) {
      setActiveSectionId('')
      return
    }

    const onScroll = () => {
      let current = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= READING_ANCHOR + 8) current = id
        else break
      }
      setActiveSectionId(current)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [article])

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - (HEADER_H + 20)
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const handleSelectPage = (pageId: string, sectionId?: string) => {
    setSearchParams({ page: pageId })
    setIsMobileMenuOpen(false)
    if (sectionId) {
      setActiveSectionId(sectionId)
      setTimeout(() => scrollToHeading(sectionId), 80)
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }

  const currentIndex = ALL_DOC_PAGES.findIndex((p) => p.id === activePageId)
  const prevPage = currentIndex > 0 ? ALL_DOC_PAGES[currentIndex - 1] : null
  const nextPage = currentIndex < ALL_DOC_PAGES.length - 1 ? ALL_DOC_PAGES[currentIndex + 1] : null

  /* The topic list, shared by the desktop rail and the mobile drawer so the two
     can never list different things. */
  const TopicList = ({ dense = false }: { dense?: boolean }) => (
    <nav aria-label="Documentation topics">
      {DOC_CATEGORIES.map((cat) => (
        <div key={cat.title} className="mb-5">
          <div className="mb-1.5 select-none pl-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
            {cat.title}
          </div>
          <div>
            {cat.pages.map((p) => {
              const on = p.id === activePageId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPage(p.id)}
                  aria-current={on ? 'page' : undefined}
                  className={`mb-0.5 block w-full border-l-2 py-1.5 pl-2.5 pr-2 text-left text-[12.5px] transition-colors ${
                    on
                      ? 'border-emerald bg-[rgba(13,107,79,.07)] font-medium text-ink'
                      : 'border-transparent text-ink-2 hover:border-rule-strong hover:bg-paper-3 hover:text-ink'
                  } ${dense ? 'py-2' : ''}`}
                >
                  {p.title}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="relative min-h-[100dvh] bg-paper text-ink">
      <Substrate />

      <div className="relative z-[1] flex min-h-[100dvh] flex-col">
        <SiteHeader />

        <div className="mx-auto flex w-full max-w-site flex-1 items-start px-6 md:px-10 lg:px-14">
          {/* ══ left rail: every topic ═══════════════════════════════════ */}
          <aside
            className="docs-rail hidden w-[236px] flex-none border-r border-rule py-8 pr-5 lg:block"
            aria-label="Documentation navigation"
            data-lenis-prevent
          >
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search documentation"
              className="mb-6 flex w-full items-center justify-between gap-2 border border-rule-strong bg-paper-2 px-2.5 py-2 text-ink-3 transition-colors hover:border-ink-3 hover:text-ink-2"
            >
              <span className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
                <span className="font-mono text-[10.5px]">Search docs</span>
              </span>
              <span className="rounded-[2px] border border-rule px-1 py-px font-mono text-[8.5px]">
                ⌘K
              </span>
            </button>

            <TopicList />
          </aside>

          {/* ══ mobile topic bar ═════════════════════════════════════════ */}
          <div className="flex w-full items-center justify-between gap-3 border-b border-rule py-2.5 lg:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-expanded={isMobileMenuOpen}
              className="flex items-center gap-2 border border-rule-strong bg-paper-2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
              Topics
            </button>
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
            >
              Search ⌘K
            </button>
          </div>

          {/* ══ centre: the article ══════════════════════════════════════ */}
          <main className="min-w-0 flex-1 px-0 py-8 lg:px-10">
            <div className="mx-auto max-w-[680px]">
              {/* breadcrumb */}
              <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-3">
                <button
                  type="button"
                  onClick={() => handleSelectPage('what-is-archon')}
                  className="transition-colors hover:text-ink"
                >
                  Docs
                </button>
                <span aria-hidden="true">/</span>
                <span>{article.category}</span>
              </nav>

              <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.036em] md:text-[36px]">
                {article.title}
              </h1>

              <p className="mt-4 border-b border-rule pb-6 text-[15px] leading-[1.7] text-ink-2">
                {article.lead}
              </p>

              {/* article body — authored in docsArticles with the doc primitives */}
              <div className="docs-content-body mt-7">{article.body}</div>

              {/* prev / next */}
              <div className="mt-14 grid grid-cols-1 gap-3 border-t border-rule pt-6 sm:grid-cols-2">
                {prevPage ? (
                  <button
                    type="button"
                    onClick={() => handleSelectPage(prevPage.id)}
                    className="flex flex-col items-start border border-rule bg-paper-2 p-4 text-left transition-colors hover:border-ink-3"
                  >
                    <span className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                      ← Previous
                    </span>
                    <span className="text-[13.5px] font-medium text-ink">{prevPage.title}</span>
                  </button>
                ) : (
                  <div />
                )}

                {nextPage && (
                  <button
                    type="button"
                    onClick={() => handleSelectPage(nextPage.id)}
                    className="flex flex-col items-end border border-rule bg-paper-2 p-4 text-right transition-colors hover:border-ink-3"
                  >
                    <span className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
                      Next →
                    </span>
                    <span className="text-[13.5px] font-medium text-ink">{nextPage.title}</span>
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* ══ right rail: on this page ═════════════════════════════════ */}
          <aside
            className="docs-rail hidden w-[196px] flex-none py-8 pl-5 xl:block"
            aria-label="On this page"
            data-lenis-prevent
          >
            {article.sections.length > 0 && (
              <>
                <div className="mb-3 select-none pl-3 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  On this page
                </div>
                <nav aria-label="Article sections" className="flex flex-col border-l border-rule">
                  {article.sections.map((sec) => {
                    const on = activeSectionId === sec.id
                    return (
                      <a
                        key={sec.id}
                        href={`#${sec.id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          setActiveSectionId(sec.id)
                          scrollToHeading(sec.id)
                          window.history.pushState(null, '', `#${sec.id}`)
                        }}
                        aria-current={on ? 'location' : undefined}
                        className={`-ml-px border-l-2 py-1.5 pl-3 pr-1 text-[12px] leading-[1.45] transition-colors ${
                          on
                            ? 'border-emerald font-medium text-emerald'
                            : 'border-transparent text-ink-3 hover:border-rule-strong hover:text-ink-2'
                        }`}
                      >
                        {sec.title}
                      </a>
                    )
                  })}
                </nav>
              </>
            )}
          </aside>
        </div>

        <SiteFooter />
      </div>

      {/* ══ mobile topic drawer ═════════════════════════════════════════ */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[120] bg-[rgba(21,22,26,.5)] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Documentation topics"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-[84%] max-w-[330px] overflow-y-auto border-r border-rule bg-paper p-5"
            data-lenis-prevent
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">
                Topics
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close topics"
                className="font-mono text-[13px] text-ink-3 transition-colors hover:text-ink"
              >
                ✕
              </button>
            </div>
            <TopicList dense />
          </div>
        </div>
      )}

      <DocSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPage={handleSelectPage}
      />
    </div>
  )
}
