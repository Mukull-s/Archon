import React, { useState, useEffect, useRef } from 'react';
import { DOC_ARTICLES } from '../../data/docsArticles';
import { ALL_DOC_PAGES } from '../../data/docsContent';

interface DocSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (pageId: string, sectionId?: string) => void;
}

interface SearchResult {
  pageId: string;
  title: string;
  category: string;
  matchedText: string;
  sectionId?: string;
  type: 'page' | 'section';
}

export default function DocSearchModal({ isOpen, onClose, onSelectPage }: DocSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Compute search results
  const results: SearchResult[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default: show quick suggestions from ALL_DOC_PAGES
      return ALL_DOC_PAGES.slice(0, 6).map(p => ({
        pageId: p.id,
        title: p.title,
        category: DOC_ARTICLES[p.id]?.category || 'General',
        matchedText: p.summary,
        type: 'page' as const,
      }));
    }

    const matches: SearchResult[] = [];

    for (const page of ALL_DOC_PAGES) {
      const article = DOC_ARTICLES[page.id];
      if (!article) continue;

      const titleMatch = article.title.toLowerCase().includes(q);
      const leadMatch = article.lead.toLowerCase().includes(q);
      const categoryMatch = article.category.toLowerCase().includes(q);

      if (titleMatch || leadMatch || categoryMatch) {
        matches.push({
          pageId: page.id,
          title: article.title,
          category: article.category,
          matchedText: article.lead,
          type: 'page',
        });
      }

      // Check section headings
      for (const sec of article.sections) {
        if (sec.title.toLowerCase().includes(q)) {
          matches.push({
            pageId: page.id,
            title: `${article.title} → ${sec.title}`,
            category: article.category,
            matchedText: `Section in ${article.title}`,
            sectionId: sec.id,
            type: 'section',
          });
        }
      }
    }

    return matches.slice(0, 8);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (results.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % (results.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) {
          onSelectPage(selected.pageId, selected.sectionId);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose, onSelectPage]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#121217',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(176, 38, 255, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Search Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search documentation (e.g., AST, Tarjan, limits, RAG)..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '15px',
              fontFamily: 'inherit',
            }}
          />
          <span style={{
            fontSize: '11px',
            color: '#71717a',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontFamily: 'monospace',
          }}>
            ESC
          </span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#71717a', fontSize: '14px' }}>
              No matching documentation pages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((res, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${res.pageId}-${res.sectionId || ''}-${idx}`}
                  onClick={() => {
                    onSelectPage(res.pageId, res.sectionId);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(176, 38, 255, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(176, 38, 255, 0.25)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: isSelected ? '#fff' : '#e4e4e7',
                    }}>
                      {res.title}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#a1a1aa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}>
                      {res.category}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: isSelected ? '#d4d4d8' : '#71717a',
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {res.matchedText}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(255, 255, 255, 0.01)',
          fontSize: '11px',
          color: '#71717a',
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span><kbd style={{ fontFamily: 'monospace', color: '#a1a1aa' }}>↑↓</kbd> to navigate</span>
            <span><kbd style={{ fontFamily: 'monospace', color: '#a1a1aa' }}>↵</kbd> to select</span>
          </div>
          <span>Archon Docs Index</span>
        </div>
      </div>
    </div>
  );
}
