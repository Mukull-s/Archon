import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/sections/Footer';
import { DOC_CATEGORIES, ALL_DOC_PAGES } from '../data/docsContent';
import { DOC_ARTICLES } from '../data/docsArticles';
import DocSearchModal from '../components/docs/DocSearchModal';

export default function DocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active page ID from query string or default to 'what-is-archon'
  const pageParam = searchParams.get('page');
  const activePageId = (pageParam && DOC_ARTICLES[pageParam]) ? pageParam : 'what-is-archon';

  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const article = DOC_ARTICLES[activePageId] || DOC_ARTICLES['what-is-archon'];

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
    const sectionElements = article.sections
      .map(s => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (sectionElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sectionElements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [article]);

  const handleSelectPage = (pageId: string, sectionId?: string) => {
    setSearchParams({ page: pageId });
    setIsMobileMenuOpen(false);

    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
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
    <div style={{
      minHeight: '100vh',
      background: '#09090b',
      color: '#e4e1e5',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
    }}>
      {/* Top Navbar */}
      <Navbar />

      {/* Main Documentation Shell */}
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        paddingTop: '80px', // Clear fixed navbar
        flex: 1,
        display: 'flex',
        position: 'relative',
      }}>
        {/* ============================================================ */}
        {/* LEFT SIDEBAR (Desktop) */}
        {/* ============================================================ */}
        <aside
          className="docs-sidebar"
          data-lenis-prevent
          style={{
            width: '270px',
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.07)',
            padding: '24px 16px 80px 24px',
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 80px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          {/* Quick Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#71717a',
              fontSize: '13px',
              cursor: 'pointer',
              marginBottom: '24px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(176, 38, 255, 0.3)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span>Search docs...</span>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#a1a1aa',
              fontFamily: 'monospace',
            }}>
              ⌘K
            </span>
          </button>

          {/* Navigation Categories */}
          <nav>
            {DOC_CATEGORIES.map((cat) => (
              <div key={cat.title} style={{ marginBottom: '22px' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#71717a',
                  paddingLeft: '8px',
                  marginBottom: '6px',
                }}>
                  {cat.title}
                </div>
                <div>
                  {cat.pages.map((p) => {
                    const isActive = p.id === activePageId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPage(p.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: isActive ? 'rgba(176, 38, 255, 0.1)' : 'transparent',
                          color: isActive ? '#fff' : '#a1a1aa',
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 400,
                          border: 'none',
                          borderLeft: isActive ? '2px solid var(--accent, #b026ff)' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          marginBottom: '2px',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            e.currentTarget.style.color = '#a1a1aa';
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
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
        <div className="docs-mobile-bar" style={{
          display: 'none',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#0d0d11',
          width: '100%',
          position: 'sticky',
          top: '70px',
          zIndex: 40,
        }}>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f4f4f5',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span>Menu & Topics</span>
          </button>
          <button
            onClick={() => setIsSearchOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '13px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            🔍 Search
          </button>
        </div>

        {/* Mobile Drawer Overlay */}
        {isMobileMenuOpen && (
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '80%',
                maxWidth: '320px',
                height: '100%',
                background: '#121217',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '24px 16px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Documentation Topics</span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: '#71717a', fontSize: '18px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              {DOC_CATEGORIES.map((cat) => (
                <div key={cat.title} style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#71717a', marginBottom: '6px' }}>
                    {cat.title}
                  </div>
                  {cat.pages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPage(p.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: p.id === activePageId ? 'rgba(176, 38, 255, 0.15)' : 'transparent',
                        color: p.id === activePageId ? '#fff' : '#a1a1aa',
                        fontSize: '13px',
                        border: 'none',
                        display: 'block',
                      }}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* CENTER COLUMN: MAIN CONTENT */}
        {/* ============================================================ */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '40px 48px 80px',
            maxWidth: '860px',
          }}
        >
          {/* Breadcrumbs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#71717a',
            marginBottom: '16px',
          }}>
            <span
              onClick={() => handleSelectPage('what-is-archon')}
              style={{ cursor: 'pointer', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#71717a')}
            >
              Docs
            </span>
            <span>/</span>
            <span>{article.category}</span>
            <span>/</span>
            <span style={{ color: '#d4d4d8' }}>{article.title}</span>
          </div>

          {/* Category Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: '100px',
            background: 'rgba(176, 38, 255, 0.08)',
            border: '1px solid rgba(176, 38, 255, 0.2)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--accent, #b026ff)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '12px',
          }}>
            {article.category}
          </div>

          {/* Article Title */}
          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: '#fff',
            marginBottom: '12px',
            lineHeight: 1.25,
          }}>
            {article.title}
          </h1>

          {/* Lead Summary */}
          <p style={{
            fontSize: '16px',
            lineHeight: 1.7,
            color: '#a1a1aa',
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            {article.lead}
          </p>

          {/* Article Body */}
          <div className="docs-content-body" style={{ color: '#d4d4d8' }}>
            {article.body}
          </div>

          {/* Bottom Pagination Links */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginTop: '64px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            {prevPage ? (
              <button
                onClick={() => handleSelectPage(prevPage.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(176, 38, 255, 0.3)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <span style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>← PREVIOUS</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{prevPage.title}</span>
              </button>
            ) : <div />}

            {nextPage && (
              <button
                onClick={() => handleSelectPage(nextPage.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  padding: '16px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(176, 38, 255, 0.3)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                <span style={{ fontSize: '11px', color: '#71717a', marginBottom: '4px' }}>NEXT →</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{nextPage.title}</span>
              </button>
            )}
          </div>
        </main>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: ON THIS PAGE (TOC) */}
        {/* ============================================================ */}
        <aside
          className="docs-toc"
          data-lenis-prevent="true"
          style={{
            width: '230px',
            flexShrink: 0,
            padding: '40px 24px 40px 16px',
            position: 'sticky',
            top: '80px',
            height: 'calc(100vh - 80px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#71717a',
            marginBottom: '12px',
          }}>
            On this page
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {article.sections.map((sec) => {
              const isSelected = activeSectionId === sec.id;
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSectionId(sec.id);
                    const el = document.getElementById(sec.id);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  style={{
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: isSelected ? 'var(--accent, #b026ff)' : '#71717a',
                    fontWeight: isSelected ? 600 : 400,
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.color = '#d4d4d8';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.color = '#71717a';
                  }}
                >
                  {sec.title}
                </a>
              );
            })}
          </div>
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
          background: rgba(255, 255, 255, 0.12);
          border-radius: 4px;
        }
        .docs-sidebar::-webkit-scrollbar-thumb:hover,
        .docs-toc::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        @media (max-width: 1080px) {
          .docs-toc {
            display: none !important;
          }
        }
        @media (max-width: 768px) {
          .docs-sidebar {
            display: none !important;
          }
          .docs-mobile-bar {
            display: flex !important;
          }
          main {
            padding: 24px 16px 60px !important;
          }
        }
      `}</style>

      {/* Global Footer */}
      <Footer />
    </div>
  );
}
