import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography } from '../ui/DesignSystem';
import api from '../../lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  scannedFiles?: { path: string }[];
  currentRepoId?: string;
  onSwitchRepo?: (repoId: string) => void;
  astMetadata?: Record<string, {
    imports: string[];
    exports: string[];
    classes: any[];
    functions: any[];
  }>;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'AI Actions' | 'Routes' | 'Files' | 'Classes' | 'Functions' | 'Recent Items';
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  scannedFiles = [],
  currentRepoId,
  onSwitchRepo,
  astMetadata = {}
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<{ id: string; name: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // LocalStorage keys for recent searches and items
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<Omit<CommandItem, 'action'>[]>([]);

  // Load recent searches & items from localStorage
  useEffect(() => {
    try {
      const savedSearches = localStorage.getItem('archon_palette_recent_searches');
      const savedItems = localStorage.getItem('archon_palette_recent_items');
      if (savedSearches) setRecentSearches(JSON.parse(savedSearches));
      if (savedItems) setRecentItems(JSON.parse(savedItems));
    } catch (e) {
      console.error('Failed to load recent items from localStorage', e);
    }
  }, [isOpen]);

  // Fetch repositories list on mount or when palette opens
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const { data } = await api.get('/repos');
        if (data.data) {
          setRepos(data.data.map((r: any) => ({ id: r.id, name: r.name })));
        }
      } catch (err) {
        console.error('Failed to load repositories in command palette:', err);
      }
    })();
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Helper to handle item activation and save to recent lists
  const handleItemSelect = (item: Omit<CommandItem, 'action'>, actionFn: () => void) => {
    // 1. Save query to recent searches if not empty
    if (search.trim()) {
      setRecentSearches(prev => {
        const next = [search.trim(), ...prev.filter(s => s !== search.trim())].slice(0, 5);
        localStorage.setItem('archon_palette_recent_searches', JSON.stringify(next));
        return next;
      });
    }

    // 2. Save item to recent items
    setRecentItems(prev => {
      const next = [item, ...prev.filter(i => i.id !== item.id)].slice(0, 5);
      localStorage.setItem('archon_palette_recent_items', JSON.stringify(next));
      return next;
    });

    // 3. Execute action
    actionFn();
  };

  // Command items mapping
  const items = React.useMemo(() => {
    const list: CommandItem[] = [];

    // Group 1: Navigation
    const navItems = [
      { id: 'nav-overview', title: 'Go to Overview', subtitle: 'View repository story, onboarding, and complexity statistics', tab: 'summary' },
      { id: 'nav-explorer', title: 'Go to Repository Explorer', subtitle: 'Explore codebase files, imports, and functionality clusters', tab: 'explorer' },
      { id: 'nav-arch', title: 'Go to Architecture Graph', subtitle: 'Inspect modular dependency relationships and cycles', tab: 'graph' },
      { id: 'nav-flow', title: 'Go to Execution Flow Tracing', subtitle: 'Trace request routes down to database actions', tab: 'trace' },
      { id: 'nav-impact', title: 'Go to Impact Analysis', subtitle: 'Simulate file change blast radius and integration test failures', tab: 'impact' },
      { id: 'nav-chat', title: 'Go to Ask AI Assistant', subtitle: 'Ask questions with evidence grounding', tab: 'chat' },
      { id: 'nav-settings', title: 'Go to Settings', subtitle: 'Configure LLM model configurations and ingestion filters', tab: 'settings' }
    ];

    navItems.forEach(nav => {
      const itemRecord: CommandItem = {
        id: nav.id,
        title: nav.title,
        subtitle: nav.subtitle,
        category: 'Navigation',
        action: () => {
          onNavigate(nav.tab);
          onClose();
        }
      };
      list.push(itemRecord);
    });

    // Group 2: AI Actions
    const aiActions = [
      { id: 'ai-explain-code', title: 'AI Assistant: Explain Code', subtitle: 'Explain the active file, function, or component logic', query: 'Can you analyze the key code files and explain the main logic patterns?' },
      { id: 'ai-security', title: 'AI Assistant: Find Security Issues', subtitle: 'Scan the codebase for common security issues', query: 'Scan the codebase for potential security concerns, authorization bugs, or dependency risks.' },
      { id: 'ai-optimize', title: 'AI Assistant: Suggest Optimizations', subtitle: 'Find memory leaks, high complexity functions, or bottlenecks', query: 'Review the codebase and suggest performance optimizations and cleanups.' },
      { id: 'ai-test-strategy', title: 'AI Assistant: Generate Test Strategy', subtitle: 'Create an integration and unit testing plan', query: 'Suggest an integration and unit testing strategy for the core files in this repo.' }
    ];

    aiActions.forEach(ai => {
      const itemRecord: CommandItem = {
        id: ai.id,
        title: ai.title,
        subtitle: ai.subtitle,
        category: 'AI Actions',
        action: () => {
          window.dispatchEvent(new CustomEvent('command-palette-trigger-chat', { detail: ai.query }));
          onClose();
        }
      };
      list.push(itemRecord);
    });

    // Helper to switch page and focus file
    const navigateToFile = (filePath: string) => {
      onNavigate('explorer');
      window.dispatchEvent(new CustomEvent('command-palette-select-file', { detail: filePath }));
      onClose();
    };

    // Group 3: Routes
    scannedFiles.forEach(file => {
      const pathLower = file.path.toLowerCase();
      const isRoute = pathLower.includes('/routes/') || pathLower.includes('/route/') || pathLower.includes('.route.') || pathLower.includes('.routes.') || pathLower.includes('api/');
      if (isRoute) {
        list.push({
          id: `route-${file.path}`,
          title: `Route: ${file.path.split('/').pop() || file.path}`,
          subtitle: file.path,
          category: 'Routes',
          action: () => navigateToFile(file.path)
        });
      }
    });

    // Group 4: Classes
    Object.entries(astMetadata).forEach(([filePath, meta]) => {
      if (meta?.classes && Array.isArray(meta.classes)) {
        meta.classes.forEach((cls: any) => {
          const className = typeof cls === 'string' ? cls : cls.name;
          if (className) {
            list.push({
              id: `class-${filePath}-${className}`,
              title: `class ${className}`,
              subtitle: `Declared in ${filePath}`,
              category: 'Classes',
              action: () => navigateToFile(filePath)
            });
          }
        });
      }
    });

    // Group 5: Functions
    Object.entries(astMetadata).forEach(([filePath, meta]) => {
      if (meta?.functions && Array.isArray(meta.functions)) {
        meta.functions.forEach((fn: any) => {
          const fnName = typeof fn === 'string' ? fn : fn.name;
          if (fnName) {
            list.push({
              id: `fn-${filePath}-${fnName}`,
              title: `${fnName}()`,
              subtitle: `Function in ${filePath}`,
              category: 'Functions',
              action: () => navigateToFile(filePath)
            });
          }
        });
      }
    });

    // Group 6: Files
    scannedFiles.forEach(file => {
      list.push({
        id: `file-${file.path}`,
        title: file.path.split('/').pop() || file.path,
        subtitle: file.path,
        category: 'Files',
        action: () => navigateToFile(file.path)
      });
    });

    return list;
  }, [scannedFiles, astMetadata]);

  // Filter items based on search input
  const filteredItems = React.useMemo(() => {
    if (!search.trim()) {
      // If search is empty, show recent searches + recent items + navigation list
      const list: CommandItem[] = [];

      // Add recent items
      recentItems.forEach(r => {
        const fullItem = items.find(i => i.id === r.id);
        if (fullItem) {
          list.push({
            ...r,
            category: 'Recent Items',
            action: fullItem.action
          } as CommandItem);
        }
      });

      // Add standard navigation
      const navList = items.filter(i => i.category === 'Navigation');
      list.push(...navList);

      return list;
    }

    const q = search.toLowerCase();
    return items.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    ).slice(0, 30); // Cap at 30 items
  }, [items, search, recentItems]);

  // Listen for navigation keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const activeItem = filteredItems[activeIndex];
        if (activeItem) {
          const itemRecord = {
            id: activeItem.id,
            title: activeItem.title,
            subtitle: activeItem.subtitle,
            category: (activeItem.category === 'Recent Items' ? 'Recent Items' : activeItem.category) as any
          };
          handleItemSelect(itemRecord, activeItem.action);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, filteredItems, search]);

  // Adjust activeIndex if filteredItems shrinks
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Quick action to clear history
  const handleClearHistory = () => {
    localStorage.removeItem('archon_palette_recent_searches');
    localStorage.removeItem('archon_palette_recent_items');
    setRecentSearches([]);
    setRecentItems([]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#09090b]/80 backdrop-blur-sm z-0"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            ref={containerRef}
            className="relative z-10 w-[calc(100%-32px)] md:w-full max-w-[620px] bg-[#131316] border border-[#27272a] rounded-[8px] shadow-2xl flex flex-col overflow-hidden max-h-[500px]"
          >
            {/* Input Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#27272a]">
              <svg width="20" height="20" className="w-5 h-5 text-[#919095] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files, routes, classes, functions, or navigation..."
                aria-label="Search files, routes, classes, functions, or navigation"
                className="w-full bg-transparent text-[14px] text-[#fafafa] font-mono placeholder-[#919095] focus:outline-none"
              />
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1b1b1e] border border-[#27272a] rounded-[4px] text-[#919095] uppercase select-none">
                ESC
              </span>
            </div>

            {/* List Results */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin max-h-[350px]">
              {/* Recent Searches */}
              {!search && recentSearches.length > 0 && (
                <div className="px-3 py-2 border-b border-[#27272a]/50">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold tracking-wider text-[#919095]/70 uppercase select-none mb-1.5">
                    <span>Recent Searches</span>
                    <button onClick={handleClearHistory} className="hover:text-red-400 cursor-pointer" title="Clear history" aria-label="Clear history">Clear History</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map(q => (
                      <span
                        key={q}
                        onClick={() => setSearch(q)}
                        className="bg-[#1f1f22] text-[#fafafa] hover:bg-[#2e2e33] border border-[#27272a] rounded px-2 py-0.5 text-[11px] font-mono cursor-pointer select-none"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {filteredItems.length === 0 ? (
                <div className="py-12 text-center">
                  <Typography variant="body" className="text-[#919095]">
                    No matches found for <span className="text-[#fafafa] font-mono font-medium">"{search}"</span>
                  </Typography>
                </div>
              ) : (
                (() => {
                  let lastCategory = '';
                  return filteredItems.map((item, index) => {
                    const isSelected = index === activeIndex;
                    const showCategoryHeader = item.category !== lastCategory;
                    lastCategory = item.category;

                    return (
                      <React.Fragment key={item.id}>
                        {showCategoryHeader && (
                          <div className="px-3 py-1.5 mt-2 first:mt-0 text-[10px] font-mono font-bold tracking-wider text-[#919095]/70 uppercase select-none">
                            {item.category}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const itemRecord = {
                              id: item.id,
                              title: item.title,
                              subtitle: item.subtitle,
                              category: (item.category === 'Recent Items' ? 'Recent Items' : item.category) as any
                            };
                            handleItemSelect(itemRecord, item.action);
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-[6px] text-left transition-all duration-75 cursor-pointer ${
                            isSelected 
                              ? 'bg-[#1f1f22] text-[#fafafa]' 
                              : 'text-[#919095] hover:bg-[#1b1b1e]/50'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5 truncate pr-4">
                            <span className={`text-[13px] font-mono font-medium transition-colors ${
                              isSelected ? 'text-[#fafafa]' : 'text-[#c8c5ca]'
                            }`}>
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="text-[11px] text-[#919095] truncate font-mono">
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="text-[11px] font-mono text-[#3b82f6] font-bold flex-shrink-0">
                              ↵ Enter
                            </span>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
