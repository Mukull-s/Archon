import React from 'react';
import { Link } from 'react-router-dom';
import { Typography, Badge } from './DesignSystem';

interface SidebarLinkProps {
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  badge?: string;
  isCollapsed?: boolean;
}

export const SidebarLink = ({
  label,
  icon,
  isActive = false,
  onClick,
  badge,
  isCollapsed = false
}: SidebarLinkProps) => {
  return (
    <button
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={`w-full flex items-center rounded-[6px] transition-all duration-150 group cursor-pointer relative ${
        isCollapsed ? 'justify-center px-0 py-2.5' : 'justify-between px-3 py-2 text-left'
      } ${
        isActive 
          ? 'bg-[#1f1f22] text-[#fafafa]' 
          : 'text-[#919095] hover:bg-[#1b1b1e] hover:text-[#e4e1e5]'
      }`}
    >
      {/* Active Left indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-[20%] bottom-[20%] w-[3px] bg-[#3b82f6] rounded-[2px]" />
      )}
      
      <div className="flex items-center gap-3">
        <span className={`flex-shrink-0 transition-colors duration-150 ${
          isActive ? 'text-[#3b82f6]' : 'text-[#919095] group-hover:text-[#e4e1e5]'
        }`}>
          {icon}
        </span>
        {!isCollapsed && (
          <Typography 
            variant="body" 
            as="span"
            className={`text-[13px] font-medium tracking-tight ${
              isActive ? 'text-[#fafafa]' : 'text-[#919095] group-hover:text-[#e4e1e5]'
            }`}
          >
            {label}
          </Typography>
        )}
      </div>

      {!isCollapsed && badge && (
        <Badge variant="neutral" className="text-[9px] px-1 py-0">{badge}</Badge>
      )}
    </button>
  );
};

interface SidebarProps {
  repoName: string;
  repoOwner?: string | null;
  repoType?: string; // 'PUBLIC' or 'PRIVATE'
  children?: React.ReactNode;
  footer?: React.ReactNode;
  isCollapsed?: boolean;
}

export const Sidebar = ({
  repoName,
  repoOwner,
  repoType = 'PUBLIC',
  children,
  footer,
  isCollapsed = false
}: SidebarProps) => {
  return (
    <div className="w-full h-full border-r border-[#27272a] bg-[#0e0e11] flex flex-col flex-shrink-0 z-30 select-none">
      {/* Top Header */}
      <div className={`border-b border-[#27272a] flex flex-col ${isCollapsed ? 'p-3 items-center justify-center' : 'p-4 gap-2'}`}>
        <Link to="/" className="flex items-center gap-2 text-decoration-none group" style={{ textDecoration: 'none' }}>
          {/* Logo Monogram */}
          <img src="/Archonlogo.png" alt="Archon Logo" className="w-5 h-5 object-contain shrink-0" />
          {!isCollapsed && (
            <>
              <Typography variant="headline" as="h1" className="text-[15px] font-bold tracking-tight text-[#fafafa] group-hover:text-[#3b82f6] transition-colors">
                Archon
              </Typography>
              <span className="text-[10px] font-mono text-[#919095] px-1 bg-[#1f1f22] border border-[#27272a] rounded-[4px]">
                v3
              </span>
            </>
          )}
        </Link>

        {/* Repo Details */}
        {!isCollapsed && (
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <Typography variant="body" as="span" className="text-[12px] font-semibold text-[#fafafa] truncate max-w-[130px]">
                {repoName}
              </Typography>
              <Badge variant="neutral" className="text-[9px] px-1.5 py-0">
                {repoType}
              </Badge>
            </div>
            {repoOwner && (
              <Typography variant="body-sm" as="span" className="text-[11px] text-[#919095] truncate">
                {repoOwner}
              </Typography>
            )}
          </div>
        )}
      </div>

      {/* Nav Links area */}
      <div className={`flex-1 overflow-y-auto space-y-1.5 scrollbar-thin ${isCollapsed ? 'p-2' : 'p-3'}`} data-lenis-prevent>
        {children}
      </div>

      {/* Sidebar Footer */}
      {footer && (
        <div className={`border-t border-[#27272a] ${isCollapsed ? 'p-2 flex justify-center' : 'p-4'}`}>
          {footer}
        </div>
      )}
    </div>
  );
};
