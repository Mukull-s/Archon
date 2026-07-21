import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography, Badge, Button, Panel } from '../ui/DesignSystem';
import { Sidebar, SidebarLink } from '../ui/Sidebar';
import { Breadcrumbs } from '../ui/Navigation';
import CommandPalette from './CommandPalette';
import { useAuthStore } from '../../stores/authStore';

interface AppShellProps {
  repository: {
    id: string;
    name: string;
    owner: string | null;
    isLocal: boolean;
    confidence: number;
    scannedFiles: { path: string }[];
  } | null;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  loading?: boolean;
  children: React.ReactNode;
}

export default function AppShell({
  repository,
  activeTab,
  setActiveTab,
  loading = false,
  children
}: AppShellProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Watch for keyboard trigger ctrl+k / cmd+k
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  // Map tab IDs to display labels for breadcrumbs
  const tabLabels: Record<string, string> = {
    summary: 'Overview',
    explorer: 'Explorer',
    graph: 'Architecture',
    trace: 'Execution Flow',
    impact: 'Impact Analysis',
    chat: 'AI Assistant',
    settings: 'Settings'
  };

  const currentTabLabel = tabLabels[activeTab] || 'Overview';

  // Toggle handlers
  const handleSwitchRepo = (newId: string) => {
    navigate(`/dashboard/${newId}`);
  };

  return (
    <div className="stitch-theme fixed inset-0 flex bg-[#09090b] text-[#e4e1e5] font-body overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <AnimatePresence initial={false}>
        {!isSidebarCollapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'var(--stitch-sidebar-width)', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="h-full flex-shrink-0 overflow-hidden"
          >
            <Sidebar
              repoName={repository?.name || 'Archon Core'}
              repoOwner={repository?.owner}
              repoType={repository?.isLocal ? 'LOCAL' : 'PUBLIC'}
              footer={
                <div className="flex items-center gap-3 relative">
                  <button 
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-[13px] hover:ring-2 hover:ring-[#3b82f6]/50 cursor-pointer"
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

                  {/* Profile Dropdown Popup */}
                  {showProfileDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                      <div className="absolute bottom-10 left-0 w-[180px] bg-[#131316] border border-[#27272a] rounded-[6px] shadow-2xl p-1 z-50">
                        <button
                          onClick={() => { setActiveTab('settings'); setShowProfileDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] cursor-pointer"
                        >
                          Settings
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
                />
                <SidebarLink
                  label="Settings"
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                  isActive={activeTab === 'settings'}
                  onClick={() => setActiveTab('settings')}
                />
              </div>
            </Sidebar>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="h-[48px] bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between px-4 flex-shrink-0 select-none z-20">
          <div className="flex items-center gap-3">
            {/* Collapse Sidebar Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="text-[#919095] hover:text-[#e4e1e5] p-1 rounded-[4px] hover:bg-[#1f1f22] cursor-pointer"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb Path */}
            <Breadcrumbs 
              paths={['Archon', repository?.name || 'loading', currentTabLabel]} 
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Search Trigger Input */}
            <div 
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-[200px] md:w-[260px] bg-[#09090b] border border-[#27272a] rounded-[6px] px-3 py-1 text-[12px] text-[#919095] flex items-center justify-between hover:border-[#39393c] cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search files/actions...</span>
              </div>
              <span className="text-[9px] font-mono px-1 py-0 bg-[#1f1f22] border border-[#27272a] rounded-[3px] text-[#919095]">
                ⌘K
              </span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-[#919095] hover:text-[#e4e1e5] p-1.5 rounded-[4px] hover:bg-[#1f1f22] cursor-pointer"
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
              onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
              className="text-[#919095] hover:text-[#e4e1e5] p-1.5 rounded-[4px] hover:bg-[#1f1f22] cursor-pointer"
            >
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
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

          {/* 3. RIGHT COLLAPSIBLE PANEL */}
          <AnimatePresence initial={false}>
            {!isRightPanelCollapsed && repository && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="h-full border-l border-[#27272a] bg-[#0e0e11] flex flex-col flex-shrink-0 z-10 overflow-hidden"
              >
                <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
                  <Typography variant="label-caps">Repository Details</Typography>
                  <Badge variant={repository.confidence >= 80 ? 'success' : 'warning'}>
                    {repository.confidence}% Health
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin" data-lenis-prevent>
                  <Panel className="p-3" variant="base">
                    <Typography variant="label-caps" className="text-[#919095] mb-1">Total Scope</Typography>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[20px] font-heading font-bold text-[#fafafa]">
                        {repository.scannedFiles.length}
                      </span>
                      <span className="text-[12px] text-[#919095]">tracked files</span>
                    </div>
                  </Panel>

                  <Panel className="p-3" variant="base">
                    <Typography variant="label-caps" className="text-[#919095] mb-2">Engine Confidence Checklist</Typography>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#10b981]">✓</span>
                        <span className="text-[#c8c5ca]">AST Structure mapped</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-[#10b981]">✓</span>
                        <span className="text-[#c8c5ca]">Dependency Graph connected</span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className={repository.confidence >= 80 ? 'text-[#10b981]' : 'text-[#eab308]'}>
                          {repository.confidence >= 80 ? '✓' : '⚠'}
                        </span>
                        <span className="text-[#c8c5ca]">Execution Chains analyzed</span>
                      </div>
                    </div>
                  </Panel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
      />
    </div>
  );
}
