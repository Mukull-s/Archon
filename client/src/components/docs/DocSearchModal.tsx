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

/**
 * The documentation search palette.
 *
 * A plate dropped onto a dimmed sheet — the same material as the code viewer,
 * because a command palette is a tool, not a page. Selection is marked in the
 * engine's emerald rather than a glow, so the active row is legible without
 * being lit. An empty result says so in plain words; nothing is invented to
 * fill the list.
 */
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
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/75 pt-[15vh] backdrop-blur-[6px]"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="panel panel--plate w-full max-w-[560px] shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[#2b2e36] px-4 py-3.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-[#82868f]">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search documentation (e.g., AST, Tarjan, limits, RAG)..."
            className="min-w-0 flex-1 border-none bg-transparent font-sans text-[15px] text-[#e6e9ee] outline-none placeholder:text-[#82868f]"
          />
          <span className="flex-none rounded-[3px] border border-[#31353e] px-1.5 py-0.5 font-mono text-[11px] text-[#82868f]">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[14px] text-[#82868f]">
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
                  className={`mb-1 cursor-pointer rounded-[3px] border px-3.5 py-2.5 transition-colors ${
                    isSelected
                      ? 'border-emerald/25 bg-emerald/[0.12]'
                      : 'border-transparent'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className={`text-[13px] font-semibold ${isSelected ? 'text-[#f4f1e9]' : 'text-[#e6e9ee]'}`}>
                      {res.title}
                    </span>
                    <span className="flex-none rounded-[3px] border border-[#31353e] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#82868f]">
                      {res.category}
                    </span>
                  </div>
                  <div className={`truncate text-[12px] leading-[1.4] ${isSelected ? 'text-[#c8cdd6]' : 'text-[#82868f]'}`}>
                    {res.matchedText}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-[#2b2e36] px-4 py-2.5 font-mono text-[11px] text-[#82868f]">
          <div className="flex gap-3">
            <span><kbd className="text-[#a8adb6]">↑↓</kbd> to navigate</span>
            <span><kbd className="text-[#a8adb6]">↵</kbd> to select</span>
          </div>
          <span>Archon Docs Index</span>
        </div>
      </div>
    </div>
  );
}
