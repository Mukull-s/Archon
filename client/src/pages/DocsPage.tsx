import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { DOC_CATEGORIES, ALL_DOC_PAGES } from '../data/docsContent';
import { DOC_ARTICLES } from '../data/docsArticles';
import DocSearchModal from '../components/docs/DocSearchModal';
import { Badge } from '../components/ui/DesignSystem';

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active page ID from query string or default to 'what-is-archon'
  const pageParam = searchParams.get('page');
  const activePageId = (pageParam && DOC_ARTICLES[pageParam]) ? pageParam : 'what-is-archon';

  const article = DOC_ARTICLES[activePageId] || DOC_ARTICLES['what-is-archon'];

  // Initialize active section to first section of current article
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => article.sections[0]?.id || ''
  );
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync activeSectionId whenever activePageId changes
  useEffect(() => {
    setActiveSectionId(article.sections[0]?.id || '');
  }, [activePageId]);

  // Scroll directly to top whenever activePageId changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if ((window as any).lenis) {
      try {
        (window as any).lenis.scrollTo(0, { immediate: true });
      } catch {}
    }
  }, [activePageId]);

  // Handle global Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Intersection Observer for right-hand TOC scroll spy
  useEffect(() => {
    const sectionIds = article.sections.map(s => s.id);
    if (sectionIds.length === 0) {
      setActiveSectionId('');
      return;
    }

    // Default to first section initially
    setActiveSectionId(sectionIds[0]);

    const sectionElements = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (sectionElements.length === 0) return;

    // Track which headings are in or above the reading zone
    const visibleHeadings = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          if (entry.isIntersecting) {
            visibleHeadings.set(id, entry.boundingClientRect.top);
          } else {
            visibleHeadings.delete(id);
            // If heading scrolled down out of view (user scrolled UP past this heading)
            if (entry.boundingClientRect.top > 85) {
              const index = sectionIds.indexOf(id);
              if (index > 0) {
                setActiveSectionId(sectionIds[index - 1]);
              }
            }
          }
        });

        if (visibleHeadings.size > 0) {
          // Select the topmost visible heading according to document order
          const firstVisible = sectionIds.find((id) => visibleHeadings.has(id));
          if (firstVisible) {
            setActiveSectionId(firstVisible);
          }
        }
      },
      {
        // Root margin: -85px top to clear fixed 80px Navbar; -60% bottom to focus on top 40% reading zone
        rootMargin: '-85px 0px -60% 0px',
        threshold: 0,
      }
    );

    sectionElements.forEach(el => observer.observe(el));
    return () => {
      observer.disconnect();
      visibleHeadings.clear();
    };
  }, [article]);

  const scrollToHeading = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const navbarHeight = 80;
    const breathingRoom = 16;
    const targetY = el.getBoundingClientRect().top + window.scrollY - (navbarHeight + breathingRoom);

    window.scrollTo({ top: targetY, behavior: 'smooth' });
    if ((window as any).lenis) {
      try {
        (window as any).lenis.scrollTo(targetY);
      } catch {}
    }
  };

  const handleSelectPage = (pageId: string, sectionId?: string) => {
    setSearchParams({ page: pageId });
    setIsMobileMenuOpen(false);

    if (sectionId) {
      setActiveSectionId(sectionId);
      setTimeout(() => {
        scrollToHeading(sectionId);
      }, 60);
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      if ((window as any).lenis) {
        try {
          (window as any).lenis.scrollTo(0, { immediate: true });
        } catch {}
      }
    }
  };

  // Find previous and next pages
  const currentIndex = ALL_DOC_PAGES.findIndex(p => p.id === activePageId);
  const prevPage = currentIndex > 0 ? ALL_DOC_PAGES[currentIndex - 1] : null;
  const nextPage = currentIndex < ALL_DOC_PAGES.length - 1 ? ALL_DOC_PAGES[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar />

      {/* Main Documentation Shell */}
      <div className="max-w-[1440px] mx-auto w-full pt-20 flex-1 flex items-start relative">
        {/* ============================================================ */}
        {/* LEFT SIDEBAR (Desktop) */}
        {/* ============================================================ */}
        <aside
          className="docs-sidebar hidden md:block w-[270px] flex-shrink-0 self-start border-r border-border-subtle pt-6 px-4 pb-20 pl-6 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto overscroll-contain"
          data-lenis-prevent
          aria-label="Documentation navigation"
        >
          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-subtle/50 hover:bg-surface-elevated/60 border border-border-subtle hover:border-accent/40 text-text-tertiary hover:text-text-secondary text-[13px] cursor-pointer mb-6 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Search docs (⌘K)"
          >
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Search docs...</span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-elevated text-text-secondary font-mono border border-border-subtle/40">
              ⌘K
            </span>
          </button>

          {/* Navigation Categories */}
          <nav aria-label="Documentation categories">
            {DOC_CATEGORIES.map((cat) => (
              <div key={cat.title} className="mb-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary pl-2 mb-1.5 select-none">
                  {cat.title}
                </div>
                <div>
                  {cat.pages.map((p) => {
                    const isActive = p.id === activePageId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPage(p.id)}
                        className={`w-full flex items-center text-left py-1.5 px-2.5 rounded-md text-[13px] border-l-2 cursor-pointer transition-colors duration-150 mb-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isActive
                            ? 'bg-accent/10 text-white font-semibold border-accent'
                            : 'bg-transparent text-text-secondary font-normal border-transparent hover:text-white hover:bg-surface-subtle/60'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {p.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ============================================================ */}
        {/* MOBILE NAVIGATION BAR & DRAWER */}
        {/* ============================================================ */}
        <div className="docs-mobile-bar flex md:hidden items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-base w-full sticky top-[70px] z-40">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-subtle border border-border-subtle text-text-primary text-[13px] hover:bg-surface-elevated hover:border-border-default cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open documentation navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span>Menu & Topics</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="px-3 py-1.5 rounded-md bg-transparent border-0 text-text-secondary hover:text-text-primary text-[13px] cursor-pointer ml-auto transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Search documentation"
          >
            🔍 Search
          </button>
        </div>

        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Documentation menu"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="w-4/5 max-w-[320px] h-full bg-surface-base border-r border-border-subtle p-5 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-5">
                <span className="text-[15px] font-bold text-white">Documentation Topics</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="bg-transparent border-0 text-text-tertiary hover:text-text-primary text-lg cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              {DOC_CATEGORIES.map((cat) => (
                <div key={cat.title} className="mb-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1.5 pl-1 select-none">
                    {cat.title}
                  </div>
                  {cat.pages.map((p) => {
                    const isActive = p.id === activePageId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPage(p.id)}
                        className={`w-full text-left py-2 px-2.5 rounded-md text-[13px] border-0 block cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isActive
                            ? 'bg-accent/15 text-white font-semibold'
                            : 'bg-transparent text-text-secondary hover:text-white hover:bg-surface-subtle/60'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        {p.title}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CENTER COLUMN: MAIN CONTENT */}
        {/* ============================================================ */}
        <main className="flex-1 min-w-0 px-4 py-6 md:px-12 md:py-10 pb-20 max-w-[860px]">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-tertiary mb-4">
            <button
              type="button"
              onClick={() => handleSelectPage('what-is-archon')}
              className="cursor-pointer hover:text-white transition-colors bg-transparent border-0 p-0 text-xs text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              Docs
            </button>
            <span aria-hidden="true">/</span>
            <span>{article.category}</span>
            <span aria-hidden="true">/</span>
            <span className="text-text-primary font-medium">{article.title}</span>
          </nav>

          {/* Category Pill */}
          <Badge
            variant="purple"
            className="mb-3 text-[10px] font-bold uppercase tracking-wider bg-accent/10 border-accent/25 text-accent"
          >
            {article.category}
          </Badge>

          {/* Article Title */}
          <h1 className="text-3xl font-bold tracking-tight text-white mb-3 leading-tight">
            {article.title}
          </h1>

          {/* Lead Summary */}
          <p className="text-base leading-relaxed text-text-secondary mb-8 pb-6 border-b border-border-subtle">
            {article.lead}
          </p>

          {/* Article Body */}
          <div className="docs-content-body text-text-secondary">
            {article.body}
          </div>

          {/* Bottom Pagination Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-16 pt-6 border-t border-border-subtle">
            {prevPage ? (
              <button
                type="button"
                onClick={() => handleSelectPage(prevPage.id)}
                className="flex flex-col items-start p-4 rounded-lg bg-surface-subtle/40 hover:bg-surface-elevated/60 border border-border-subtle hover:border-accent/40 cursor-pointer text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="text-[11px] font-medium text-text-tertiary mb-1">← PREVIOUS</span>
                <span className="text-sm font-semibold text-white">{prevPage.title}</span>
              </button>
            ) : <div />}

            {nextPage && (
              <button
                type="button"
                onClick={() => handleSelectPage(nextPage.id)}
                className="flex flex-col items-end p-4 rounded-lg bg-surface-subtle/40 hover:bg-surface-elevated/60 border border-border-subtle hover:border-accent/40 cursor-pointer text-right transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="text-[11px] font-medium text-text-tertiary mb-1">NEXT →</span>
                <span className="text-sm font-semibold text-white">{nextPage.title}</span>
              </button>
            )}
          </div>
        </main>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: ON THIS PAGE (TOC) */}
        {/* ============================================================ */}
        <aside
          className="docs-toc hidden min-[1081px]:block w-[230px] flex-shrink-0 self-start pt-10 px-4 pb-10 pr-6 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto overscroll-contain"
          data-lenis-prevent="true"
          aria-label="Table of contents"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3 select-none pl-3">
            On this page
          </div>

          <nav aria-label="Article sections" className="relative border-l border-border-subtle/60 pl-0 flex flex-col">
            {article.sections.map((sec) => {
              const isSelected = activeSectionId === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSectionId(sec.id);
                    scrollToHeading(sec.id);
                    window.history.pushState(null, '', `#${sec.id}`);
                  }}
                  className={`group relative text-xs leading-normal no-underline py-1.5 px-3 transition-all duration-150 rounded-r-md -ml-[1px] border-l-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    isSelected
                      ? 'border-accent text-accent font-semibold bg-accent/10'
                      : 'border-transparent text-text-tertiary font-normal hover:text-text-secondary hover:bg-surface-subtle/40 hover:border-border-default'
                  }`}
                  aria-current={isSelected ? 'location' : undefined}
                >
                  {sec.title}
                </a>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* Global Search Modal */}
      <DocSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPage={handleSelectPage}
      />

      {/* Responsive & Scrollbar Styles */}
      <style>{`
        html, body {
          overflow-x: clip !important;
        }
        .docs-sidebar,
        .docs-toc {
          position: -webkit-sticky !important;
          position: sticky !important;
          top: 80px !important;
          height: calc(100vh - 80px) !important;
          max-height: calc(100vh - 80px) !important;
          align-self: flex-start !important;
          flex-shrink: 0 !important;
        }
        .docs-sidebar::-webkit-scrollbar,
        .docs-toc::-webkit-scrollbar {
          width: 5px;
        }
        .docs-sidebar::-webkit-scrollbar-track,
        .docs-toc::-webkit-scrollbar-track {
          background: transparent;
        }
        .docs-sidebar::-webkit-scrollbar-thumb,
        .docs-toc::-webkit-scrollbar-thumb {
          background: var(--color-border-default);
          border-radius: 4px;
        }
        .docs-sidebar::-webkit-scrollbar-thumb:hover,
        .docs-toc::-webkit-scrollbar-thumb:hover {
          background: var(--color-border-strong);
        }
        .docs-content-body h2,
        .docs-content-body h3 {
          scroll-margin-top: 96px;
        }
      `}</style>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
