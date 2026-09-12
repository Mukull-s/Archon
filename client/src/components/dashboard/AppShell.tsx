import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography, Badge, Panel, Button } from '../ui/DesignSystem';
import { Sidebar, SidebarLink } from '../ui/Sidebar';
import { Breadcrumbs } from '../ui/Navigation';
import CommandPalette from './CommandPalette';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';

interface AppShellProps {
  repository: {
    id: string;
    name: string;
    owner: string | null;
    isLocal: boolean;
    confidence: number;
    scannedFiles: { path: string; size?: number; lines?: number }[];
    astMetadata?: any;
    framework?: string | null;
    languages?: string[];
    dependencyGraph?: Record<string, string[]>;
    confidenceDetails?: {
      score: number;
      checklist: string[];
    };
  } | null;
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

export default function AppShell({
  repository,
  activeTab,
  setActiveTab,
  loading = false,
  children,
  activeInvestigationEntity = null,
  onClearInvestigationEntity,
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToImpact,
}: AppShellProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Responsive state tracking
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Left Sidebar collapsible / draggable state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('archon_left_sidebar_collapsed') === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const val = localStorage.getItem('archon_left_sidebar_width');
    return val ? parseInt(val, 10) : 240;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Right Details panel 3-states: 'expanded' | 'compact' | 'hidden'
  const [rightPanelState, setRightPanelState] = useState<'expanded' | 'compact' | 'hidden'>(() => {
    const val = localStorage.getItem('archon_right_sidebar_state');
    if (val === 'expanded' || val === 'compact' || val === 'hidden') return val;
    // Default: compact on tablet/mobile, else expanded
    return window.innerWidth < 1024 ? 'compact' : 'expanded';
  });

  // Watch & Persist Collapsed States
  useEffect(() => {
    localStorage.setItem('archon_left_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('archon_left_sidebar_width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('archon_right_sidebar_state', rightPanelState);
  }, [rightPanelState]);

  // Global keyboard shortcuts (Ctrl + \ and Ctrl + Shift + \)
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Ctrl + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      
      // Ctrl + \ or Ctrl + |
      if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.key === '|')) {
        e.preventDefault();
        if (e.shiftKey) {
          // Cycle right sidebar state: expanded -> compact -> hidden -> expanded
          setRightPanelState(prev => {
            if (prev === 'expanded') return 'compact';
            if (prev === 'compact') return 'hidden';
            return 'expanded';
          });
        } else {
          // Toggle left sidebar collapse
          setIsSidebarCollapsed(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Left sidebar resize drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = e.clientX;
      if (newWidth < 120) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
        if (newWidth < 160) newWidth = 160;
        if (newWidth > 400) newWidth = 400;
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDoubleClick = () => {
    setSidebarWidth(240);
    setIsSidebarCollapsed(false);
  };

  // Map active tab displays
  const tabLabels: Record<string, string> = {
    summary: 'Overview',
    explorer: 'Explorer',
    graph: 'Architecture',
    trace: 'Execution Flow',
    impact: 'Impact Analysis',
    chat: 'AI Assistant',
    settings: 'Repo Details'
  };

  const currentTabLabel = tabLabels[activeTab] || 'Overview';

  const handleSwitchRepo = (newId: string) => {
    navigate(`/dashboard/${newId}`);
  };

  // Dynamic layout styling
  const leftSidebarStyle = isMobile
    ? {} // absolute drawers on mobile
    : {
        width: isSidebarCollapsed ? 64 : sidebarWidth,
        transition: isDragging ? 'none' : 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      };

  const rightSidebarStyle = isMobile
    ? {}
    : {
        width: rightPanelState === 'expanded' ? 280 : rightPanelState === 'compact' ? 48 : 0,
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      };

  return (
    <div className="stitch-theme fixed inset-0 flex bg-[#09090b] text-[#e4e1e5] font-body overflow-hidden">
      
      {/* MOBILE LEFT DRAWER BACKDROP */}
      {isMobile && !isSidebarCollapsed && (
        <div 
          onClick={() => setIsSidebarCollapsed(true)} 
          className="fixed inset-0 bg-black/60 z-40 animate-[fadeIn_0.2s_ease-out]" 
        />
      )}

      {/* 1. LEFT SIDEBAR */}
      <div
        style={leftSidebarStyle}
        className={`h-full flex-shrink-0 relative overflow-hidden z-40 ${
          isMobile
            ? `fixed inset-y-0 left-0 w-[240px] transform transition-transform duration-200 ${
                isSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
              }`
            : 'block'
        }`}
      >
        <Sidebar
          repoName={repository?.name || 'Archon Core'}
          repoOwner={repository?.owner}
          repoType={repository?.isLocal ? 'LOCAL' : 'PUBLIC'}
          isCollapsed={isSidebarCollapsed}
          footer={
            isSidebarCollapsed ? (
              <button 
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[13px] hover:ring-2 hover:ring-[#3b82f6]/50 cursor-pointer shrink-0"
              >
                {user?.name?.slice(0, 2).toUpperCase() || 'US'}
              </button>
            ) : (
              <div className="flex items-center gap-3 relative w-full">
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[13px] hover:ring-2 hover:ring-[#3b82f6]/50 cursor-pointer shrink-0"
                >
                  {user?.name?.slice(0, 2).toUpperCase() || 'US'}
                </button>
                <div className="flex flex-col truncate flex-1 select-none">
                  <Typography variant="body" as="span" className="text-[12px] font-semibold text-[#fafafa] truncate">
                    {user?.name || 'Developer'}
                  </Typography>
                  <Typography variant="body-sm" as="span" className="text-[10px] text-[#919095]">
                    Pro Account
                  </Typography>
                </div>

                {/* Profile dropdown menu */}
                {showProfileDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                    <div className="absolute bottom-10 left-0 w-[180px] bg-[#131316] border border-[#27272a] rounded-[6px] shadow-2xl p-1 z-50">
                      <Link
                        to="/profile"
                        onClick={() => setShowProfileDropdown(false)}
                        style={{ textDecoration: 'none' }}
                        className="w-full block text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] cursor-pointer"
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={() => { setActiveTab('settings'); setShowProfileDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] cursor-pointer"
                      >
                        Repo Details
                      </button>
                      <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#93000a]/10 hover:text-[#ffb4ab] rounded-[4px] text-[#ffb4ab] border-t border-[#27272a] mt-1 cursor-pointer"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          }
        >
          <div className="space-y-1">
            <SidebarLink
              label="Overview"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              }
              isActive={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="Explorer"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              }
              isActive={activeTab === 'explorer'}
              onClick={() => setActiveTab('explorer')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="Architecture"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a3 3 0 100-6 3 3 0 000 6zm0 0v7m0 0H8m4 0h4m-8 0a3 3 0 100 6 3 3 0 000-6zm8 0a3 3 0 100 6 3 3 0 000-6z" />
                </svg>
              }
              isActive={activeTab === 'graph'}
              onClick={() => setActiveTab('graph')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="Execution Flow"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4" />
                </svg>
              }
              isActive={activeTab === 'trace'}
              onClick={() => setActiveTab('trace')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="Impact Analysis"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
              }
              isActive={activeTab === 'impact'}
              onClick={() => setActiveTab('impact')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="AI Assistant"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              isActive={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
              isCollapsed={isSidebarCollapsed}
            />
            <SidebarLink
              label="Repo Details"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              isActive={activeTab === 'settings'}
              onClick={() => setActiveTab('settings')}
              isCollapsed={isSidebarCollapsed}
            />
          </div>
        </Sidebar>

        {/* RESIZE DIVIDER EDGE HANDLE & TOGGLE CONTROL */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-[#3b82f6]/50 transition-colors z-50 group"
          >
            {/* Edge floating collapse/expand button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }}
              className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-[#131316] border border-[#27272a] hover:border-[#3b82f6] text-[#919095] hover:text-[#fafafa] flex items-center justify-center shadow-lg z-50 cursor-pointer select-none"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                {isSidebarCollapsed ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="h-[48px] bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between px-4 flex-shrink-0 select-none z-20">
          <div className="flex items-center gap-3">
            {/* Collapse/Menu Sidebar Trigger Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="text-[#919095] hover:text-[#e4e1e5] p-1.5 rounded-[4px] hover:bg-[#1f1f22] cursor-pointer"
              title={isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Enhanced Contextual Breadcrumb Path */}
            <div className="flex items-center gap-1.5 text-[12px] font-mono select-none overflow-hidden max-w-[480px] lg:max-w-none">
              <span 
                className="text-[#919095] hover:text-[#e4e1e5] cursor-pointer shrink-0 transition-colors"
                onClick={() => setActiveTab('summary')}
              >
                Archon
              </span>
              <span className="text-[#47464a] shrink-0">/</span>
              <span 
                className="text-[#919095] hover:text-[#e4e1e5] cursor-pointer truncate shrink-0 transition-colors"
                onClick={() => setActiveTab('summary')}
                title={repository?.name}
              >
                {repository?.name || 'loading'}
              </span>
              <span className="text-[#47464a] shrink-0">/</span>
              <span className="text-[#fafafa] font-medium shrink-0">
                {currentTabLabel}
              </span>

              {/* Active Investigation Entity Badge */}
              {activeInvestigationEntity && (
                <>
                  <span className="text-[#47464a] shrink-0">/</span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#18181b] border border-[#3b82f6]/40 text-[#adc6ff] text-[11px] font-mono group shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] animate-pulse" aria-hidden="true" />
                    <span className="max-w-[140px] sm:max-w-[200px] md:max-w-[260px] truncate" title={activeInvestigationEntity}>
                      {activeInvestigationEntity.split('/').pop()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(activeInvestigationEntity);
                        toast.success('File path copied to clipboard');
                      }}
                      className="text-[#919095] hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                      title={`Copy full path: ${activeInvestigationEntity}`}
                      aria-label="Copy entity path"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    {onClearInvestigationEntity && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearInvestigationEntity();
                        }}
                        className="text-[#919095] hover:text-[#ffb4ab] p-0.5 rounded cursor-pointer transition-colors"
                        title="Clear active entity"
                        aria-label="Clear active entity"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Investigation Action if active entity is set */}
            {activeInvestigationEntity && (
              <div className="hidden sm:flex items-center gap-1.5">
                {activeTab !== 'explorer' && onNavigateToExplorer && (
                  <button
                    type="button"
                    onClick={() => onNavigateToExplorer(activeInvestigationEntity)}
                    className="h-7 px-2.5 text-[11px] font-mono rounded bg-[#18181b] hover:bg-[#27272a] text-[#c8c5ca] hover:text-white border border-[#27272a] hover:border-[#3b82f6]/40 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Inspect file in Explorer"
                  >
                    <span>Code</span>
                    <span className="text-[#3b82f6]">➔</span>
                  </button>
                )}
                {activeTab !== 'graph' && onNavigateToGraph && (
                  <button
                    type="button"
                    onClick={() => onNavigateToGraph(activeInvestigationEntity)}
                    className="h-7 px-2.5 text-[11px] font-mono rounded bg-[#18181b] hover:bg-[#27272a] text-[#c8c5ca] hover:text-white border border-[#27272a] hover:border-[#3b82f6]/40 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="View node in Architecture Graph"
                  >
                    <span>Graph</span>
                    <span className="text-[#3b82f6]">➔</span>
                  </button>
                )}
              </div>
            )}

            {/* Search Trigger Input */}
            <div 
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-[180px] md:w-[240px] bg-[#09090b] border border-[#27272a] rounded-[6px] px-3 py-1 text-[12px] text-[#919095] flex items-center justify-between hover:border-[#39393c] cursor-pointer select-none"
              role="button"
              tabIndex={0}
              title="Search files and actions (⌘K)"
              aria-label="Search files and actions (⌘K)"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCommandPaletteOpen(true); } }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="truncate">Search files/actions...</span>
              </div>
              <span className="text-[9px] font-mono px-1 py-0 bg-[#1f1f22] border border-[#27272a] rounded-[3px] text-[#919095]">
                ⌘K
              </span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-[#919095] hover:text-[#e4e1e5] p-1.5 rounded-[4px] hover:bg-[#1f1f22] cursor-pointer transition-colors"
                title="Notifications"
                aria-label="Notifications"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-[260px] bg-[#131316] border border-[#27272a] rounded-[6px] shadow-2xl p-4 z-50">
                    <Typography variant="label-caps" className="mb-2 block border-b border-[#27272a] pb-1">Notifications</Typography>
                    <Typography variant="body-sm" className="text-[#919095]">No new alerts. All systems operational.</Typography>
                  </div>
                </>
              )}
            </div>

            {/* Right Panel Toggle Button */}
            <button
              onClick={() => {
                setRightPanelState(prev => {
                  if (prev === 'hidden') return 'expanded';
                  return 'hidden';
                });
              }}
              className={`p-1.5 rounded-[4px] cursor-pointer transition-all duration-150 ${
                rightPanelState !== 'hidden' 
                  ? 'text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/30' 
                  : 'text-[#919095] hover:text-[#e4e1e5] hover:bg-[#1f1f22]'
              }`}
              title="Toggle Investigation Inspector (Ctrl+Shift+\)"
              aria-label="Toggle Investigation Inspector"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            </button>
          </div>
        </header>

        {/* LOADING / SCAN PROGRESS BAR */}
        {loading && (
          <div className="h-[2px] bg-[#27272a] w-full overflow-hidden flex-shrink-0 z-20">
            <div className="h-full bg-[#3b82f6] animate-[pulse_1.5s_infinite] w-2/3" />
          </div>
        )}

        {/* MAIN BODY SCROLL AREA */}
        <div className="flex-1 flex overflow-hidden min-w-0 max-h-[calc(100vh-48px)]">
          <main className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* MOBILE RIGHT DRAWER BACKDROP */}
          {isMobile && rightPanelState !== 'hidden' && (
            <div 
              onClick={() => setRightPanelState('hidden')} 
              className="fixed inset-0 bg-black/60 z-40 animate-[fadeIn_0.2s_ease-out]" 
            />
          )}

          {/* 3. RIGHT COLLAPSIBLE INSPECTOR PANEL */}
          {/* STATE A: EXPANDED STATE */}
          {!isMobile && rightPanelState === 'expanded' && repository && (() => {
            const activeFileItem = activeInvestigationEntity
              ? repository.scannedFiles.find(f => f.path === activeInvestigationEntity)
              : null;
            const activeFileDeps = activeInvestigationEntity && repository.dependencyGraph
              ? (repository.dependencyGraph[activeInvestigationEntity] || [])
              : [];
            const realChecks = repository.confidenceDetails?.checklist && repository.confidenceDetails.checklist.length > 0
              ? repository.confidenceDetails.checklist
              : [
                  '✓ AST Structure parsed',
                  '✓ Code dependency graph mapped',
                  repository.confidence >= 80 ? '✓ Execution flow resolved' : '⚠ Execution flow sparse'
                ];

            return (
              <div
                style={rightSidebarStyle}
                className="h-full border-l border-[#27272a] bg-[#0e0e11] flex flex-col flex-shrink-0 z-10 overflow-hidden relative"
              >
                {/* Header */}
                <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                    <Typography variant="label-caps" className="tracking-wider">
                      {activeInvestigationEntity ? 'Entity Inspector' : 'Repository Scope'}
                    </Typography>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={repository.confidence >= 80 ? 'success' : 'warning'}>
                      {repository.confidence}% Health
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setRightPanelState('compact')}
                      className="p-1 rounded hover:bg-[#1f1f22] text-[#919095] hover:text-[#fafafa] cursor-pointer"
                      title="Collapse to compact rail"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightPanelState('hidden')}
                      className="p-1 rounded hover:bg-[#93000a]/10 text-[#919095] hover:text-[#ffb4ab] cursor-pointer"
                      title="Hide inspector"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin" data-lenis-prevent>
                  {/* Contextual Entity Inspection Card */}
                  {activeInvestigationEntity && (
                    <Panel className="p-3.5 border border-[#3b82f6]/30 bg-[#131316]" variant="lowest">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[#3b82f6] font-bold">
                          Active Target
                        </span>
                        {onClearInvestigationEntity && (
                          <button
                            type="button"
                            onClick={onClearInvestigationEntity}
                            className="text-[10px] font-mono text-[#919095] hover:text-white cursor-pointer"
                          >
                            Deselect
                          </button>
                        )}
                      </div>

                      <p className="font-mono text-[12px] font-bold text-white break-all mb-2 select-all">
                        {activeInvestigationEntity}
                      </p>

                      <div className="grid grid-cols-2 gap-2 my-3 text-[11px] font-mono">
                        <div className="bg-[#09090b] border border-[#27272a] rounded p-2">
                          <span className="text-[#919095] block text-[9px] uppercase">Lines</span>
                          <span className="text-white font-semibold">{activeFileItem?.lines || '—'}</span>
                        </div>
                        <div className="bg-[#09090b] border border-[#27272a] rounded p-2">
                          <span className="text-[#919095] block text-[9px] uppercase">Outbound Deps</span>
                          <span className="text-white font-semibold">{activeFileDeps.length}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="space-y-1.5 pt-1">
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(activeInvestigationEntity)}
                            className="w-full text-left px-2.5 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-[#3b82f6]/40 text-[11px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <span>Inspect File in Explorer</span>
                            <span className="text-[#3b82f6]">➔</span>
                          </button>
                        )}
                        {onNavigateToGraph && (
                          <button
                            type="button"
                            onClick={() => onNavigateToGraph(activeInvestigationEntity)}
                            className="w-full text-left px-2.5 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-[#3b82f6]/40 text-[11px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <span>Focus in Architecture Graph</span>
                            <span className="text-[#3b82f6]">➔</span>
                          </button>
                        )}
                        {onNavigateToImpact && (
                          <button
                            type="button"
                            onClick={() => onNavigateToImpact(activeInvestigationEntity)}
                            className="w-full text-left px-2.5 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] hover:border-[#3b82f6]/40 text-[11px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer flex items-center justify-between"
                          >
                            <span>Analyze Blast Radius</span>
                            <span className="text-[#3b82f6]">➔</span>
                          </button>
                        )}
                      </div>
                    </Panel>
                  )}

                  {/* Repository Overview Stats */}
                  <Panel className="p-3" variant="base">
                    <Typography variant="label-caps" className="text-[#919095] mb-1">Tracked Scope</Typography>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[20px] font-heading font-bold text-[#fafafa]">
                        {repository.scannedFiles.length}
                      </span>
                      <span className="text-[12px] text-[#919095]">files resolved</span>
                    </div>
                    {repository.framework && (
                      <div className="mt-2 pt-2 border-t border-[#27272a] flex items-center justify-between text-[11px] font-mono text-[#919095]">
                        <span>Framework</span>
                        <span className="text-[#c8c5ca] font-medium">{repository.framework}</span>
                      </div>
                    )}
                  </Panel>

                  {/* Dynamic Engine Confidence Checklist */}
                  <Panel className="p-3" variant="base">
                    <Typography variant="label-caps" className="text-[#919095] mb-2.5">
                      Engine Confidence Checklist
                    </Typography>
                    <div className="space-y-2">
                      {realChecks.map((check: string, idx: number) => {
                        const isWarning = check.startsWith('⚠');
                        return (
                          <div key={idx} className="flex items-start gap-2 text-[11.5px] leading-snug">
                            <span className={isWarning ? 'text-[#eab308] shrink-0' : 'text-[#10b981] shrink-0'}>
                              {isWarning ? '⚠' : '✓'}
                            </span>
                            <span className="text-[#c8c5ca]">
                              {check.replace(/^[✓⚠]\s*/, '')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                </div>
              </div>
            );
          })()}

          {/* STATE B: COMPACT STATE */}
          {!isMobile && rightPanelState === 'compact' && repository && (
            <div
              onClick={() => setRightPanelState('expanded')}
              style={rightSidebarStyle}
              className="h-full border-l border-[#27272a] bg-[#0e0e11] flex flex-col items-center py-4 flex-shrink-0 z-10 cursor-pointer hover:bg-[#131316] transition-colors relative"
              title="Click to expand Investigation Inspector"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRightPanelState('expanded');
                }}
                className="p-1.5 rounded hover:bg-[#1f1f22] text-[#919095] hover:text-[#fafafa] cursor-pointer mb-6"
                title="Expand panel"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-[#3b82f6] mb-5 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </span>

              <div className="relative mb-6 shrink-0">
                <span className={`w-3.5 h-3.5 rounded-full border border-black flex items-center justify-center ${
                  repository.confidence >= 80 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                }`} />
              </div>

              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] font-mono text-[#919095] uppercase tracking-widest origin-center -rotate-90 whitespace-nowrap select-none">
                  {repository.scannedFiles.length} FILES
                </span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRightPanelState('hidden');
                }}
                className="p-1.5 rounded hover:bg-[#93000a]/10 text-[#919095] hover:text-[#ffb4ab] cursor-pointer mt-auto shrink-0"
                title="Hide details panel"
              >
                ✕
              </button>
            </div>
          )}

          {/* STATE C: HIDDEN STATE */}
          {!isMobile && rightPanelState === 'hidden' && (
            <div style={{ width: 0 }} className="h-full border-l-0 bg-[#0e0e11] overflow-hidden flex-shrink-0 transition-all duration-200" />
          )}

          {/* MOBILE OVERLAY DRAWER CONTAINER */}
          {isMobile && rightPanelState !== 'hidden' && repository && (
            <div className="fixed inset-y-0 right-0 w-[280px] bg-[#0e0e11] border-l border-[#27272a] shadow-2xl flex flex-col z-50 animate-[slideInRight_0.2s_ease-out]">
              <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
                <Typography variant="label-caps">
                  {activeInvestigationEntity ? 'Entity Inspector' : 'Repository Scope'}
                </Typography>
                <button
                  onClick={() => setRightPanelState('hidden')}
                  className="p-1.5 rounded hover:bg-[#93000a]/10 text-[#919095] hover:text-[#ffb4ab] cursor-pointer"
                  title="Close panel"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeInvestigationEntity && (
                  <Panel className="p-3 border border-[#3b82f6]/40" variant="lowest">
                    <span className="text-[10px] font-mono uppercase text-[#3b82f6] font-bold block mb-1">Active File</span>
                    <p className="font-mono text-[12px] text-white break-all mb-3 select-all">
                      {activeInvestigationEntity}
                    </p>
                    {onNavigateToExplorer && (
                      <button
                        type="button"
                        onClick={() => {
                          setRightPanelState('hidden');
                          onNavigateToExplorer(activeInvestigationEntity);
                        }}
                        className="w-full text-center py-1.5 rounded bg-[#1f1f22] text-[11px] font-mono text-white border border-[#27272a]"
                      >
                        Inspect in Explorer
                      </button>
                    )}
                  </Panel>
                )}

                <div className="flex items-center justify-between bg-[#131316] border border-[#27272a] p-3 rounded-[6px]">
                  <Typography variant="body-sm">Health Score</Typography>
                  <Badge variant={repository.confidence >= 80 ? 'success' : 'warning'}>
                    {repository.confidence}% Health
                  </Badge>
                </div>

                <Panel className="p-3" variant="base">
                  <Typography variant="label-caps" className="text-[#919095] mb-1">Total Scope</Typography>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[20px] font-heading font-bold text-[#fafafa]">
                      {repository.scannedFiles.length}
                    </span>
                    <span className="text-[12px] text-[#919095]">tracked files</span>
                  </div>
                </Panel>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GLOBAL SEARCH COMMAND PALETTE */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        scannedFiles={repository?.scannedFiles}
        currentRepoId={repository?.id}
        onSwitchRepo={handleSwitchRepo}
        astMetadata={repository?.astMetadata}
      />
    </div>
  );
}
