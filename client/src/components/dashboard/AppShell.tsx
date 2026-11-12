import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Substrate } from '../site/Substrate';

/**
 * AppShell — the frame every dashboard tab renders inside.
 *
 * Plate & Paper. The frame is the same instrument paper as the marketing site
 * and the analyse page, because a tool that looks like a different product from
 * the claim it makes is a tool nobody trusts.
 *
 * Layout: a thin app rail (repo identity + actions), then a numbered tab rail
 * (01…06) that sticks beneath it, then the tab body. The numbered rail replaces
 * the old dark sidebar — six destinations belong across the top where they can
 * all be seen at once, not stacked down the side where four are always hidden.
 *
 * Every value shown here comes from the `repository` prop, which the page
 * fetches from `GET /repos/:id`. Nothing on this frame is hardcoded.
 */

export interface AppShellRepository {
  id: string;
  name: string;
  owner: string | null;
  isLocal: boolean;
  confidence: number;
  fileCount?: number;
  indexedFileCount?: number;
  framework?: string | null;
  languages?: string[];
  scannedFiles?: { path: string; size?: number; lines?: number }[];
}

interface AppShellProps {
  repository: AppShellRepository | null;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  loading?: boolean;
  children: React.ReactNode;
  activeInvestigationEntity?: string | null;
  onClearInvestigationEntity?: () => void;
  onNavigateToExplorer?: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
}

/** The six destinations, in the order the reference numbers them. */
const TABS: { id: string; n: string; label: string }[] = [
  { id: 'summary', n: '01', label: 'Overview' },
  { id: 'explorer', n: '02', label: 'Explorer' },
  { id: 'graph', n: '03', label: 'Architecture' },
  { id: 'trace', n: '04', label: 'Execution flow' },
  { id: 'impact', n: '05', label: 'Impact analysis' },
  { id: 'chat', n: '06', label: 'Assistant' },
];

export default function AppShell({
  repository,
  activeTab,
  setActiveTab,
  children,
  activeInvestigationEntity = null,
  onClearInvestigationEntity,
  onNavigateToExplorer,
}: AppShellProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = document.getElementById('shell-account-menu');
      const btn = document.getElementById('shell-account-button');
      if (el && !el.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const repoLabel = repository
    ? repository.owner
      ? `${repository.owner}/${repository.name}`
      : repository.name
    : 'Repository';

  const indexed = repository?.indexedFileCount ?? repository?.fileCount ?? null;
  const total = repository?.scannedFiles?.length ?? null;
  const isPartial = indexed != null && total != null && indexed < total;

  const displayName = user?.name || user?.email?.split('@')[0] || 'Account';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper text-ink">
      <Substrate />

      {/* ══ app rail ══════════════════════════════════════════════════════ */}
      <div className="arail relative z-[3] flex-none">
        <div className="mx-auto flex w-full max-w-site items-center justify-between gap-6 px-6 md:px-10">
          <div className="arail__l">
            <Link to="/" className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.03em] text-ink">
              <svg className="text-emerald" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1.65" fill="currentColor" />
              </svg>
              Archon
            </Link>

            <div className="arail__crumb">
              <span className="sep">/</span>
              <span className="repo">{repoLabel}</span>
              {indexed != null && (
                <span className="sha">
                  {indexed}
                  {total != null && total !== indexed ? ` of ${total}` : ''} files
                </span>
              )}
              {isPartial && <span className="st st--warn"><i />Partial index</span>}
            </div>
          </div>

          <div className="arail__r">
            <Link to="/history" className="kbd">
              ← Repositories
            </Link>

            <button
              id="shell-account-button"
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="ico !w-auto !px-1.5 gap-2"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-forest text-[10px] font-semibold text-[#f0f6f2]">
                  {initial}
                </span>
              )}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {menuOpen && (
              <div
                id="shell-account-menu"
                role="menu"
                className="absolute right-6 top-[calc(100%+8px)] z-[95] w-[236px] overflow-hidden border border-rule bg-paper-2 shadow-dossier"
              >
                <div className="border-b border-rule bg-paper-3 px-3.5 py-3">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{displayName}</div>
                  <div className="mt-0.5 truncate font-mono text-[10px] text-ink-3">{user?.email}</div>
                </div>
                <div className="p-1">
                  {[
                    { to: '/history', label: 'My repositories' },
                    { to: '/profile', label: 'Account' },
                  ].map((i) => (
                    <Link
                      key={i.to}
                      to={i.to}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="block px-2.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate('/');
                  }}
                  className="w-full border-t border-rule px-3 py-2.5 text-left text-[12.5px] text-sig transition-colors hover:bg-[rgba(226,70,47,.07)]"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ numbered tab rail ═════════════════════════════════════════════ */}
      <div className="ktabs relative z-[2] flex-none">
        <div className="mx-auto w-full max-w-site px-6 md:px-10">
          <div className="ktabs__in" role="tablist" aria-label="Repository views">
            {TABS.map((t) => {
              const on = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveTab(t.id)}
                  className={`ktab ${on ? 'is-on' : ''}`}
                >
                  <span className="n">{t.n}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══ the investigation target, when a tab has pinned one ══════════ */}
      {activeInvestigationEntity && (
        <div className="relative z-[2] flex-none border-b border-rule bg-paper-3">
          <div className="mx-auto flex w-full max-w-site items-center gap-3 px-6 py-2 md:px-10">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-3">
              Investigating
            </span>
            <span className="min-w-0 truncate font-mono text-[11px] text-ink">{activeInvestigationEntity}</span>
            {onNavigateToExplorer && (
              <button
                type="button"
                onClick={() => onNavigateToExplorer(activeInvestigationEntity)}
                className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
              >
                Open in explorer
              </button>
            )}
            {onClearInvestigationEntity && (
              <button
                type="button"
                onClick={onClearInvestigationEntity}
                aria-label="Clear investigation target"
                className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-3 transition-colors hover:text-ink"
              >
                clear ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ the tab body ══════════════════════════════════════════════════
          The shell is viewport-locked so a tab can claim the full height
          (the graph, the explorer, the assistant). Tabs that need to run long
          scroll inside their own column rather than growing the document, so
          the app rail and tab rail never move. */}
      <main className="relative z-[2] mx-auto flex min-h-0 w-full max-w-site flex-1 flex-col overflow-y-auto px-6 py-7 md:px-10">
        {children}
      </main>
    </div>
  );
}
