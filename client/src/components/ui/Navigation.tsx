import React from 'react';
import { Typography } from './DesignSystem';

interface BreadcrumbsProps {
  paths: string[];
}

export const Breadcrumbs = ({ paths }: BreadcrumbsProps) => {
  return (
    <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#919095] select-none">
      {paths.map((p, idx) => {
        const isLast = idx === paths.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <span className="text-[#47464a]">/</span>}
            <span className={isLast ? 'text-[#fafafa] font-medium' : 'hover:text-[#e4e1e5] cursor-pointer'}>
              {p}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface TabProps {
  id: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export const Tab = ({
  id,
  label,
  isActive = false,
  onClick,
  icon
}: TabProps) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-[13px] font-medium font-heading transition-all duration-150 cursor-pointer ${
        isActive
          ? 'bg-[#1f1f22] text-[#fafafa] border border-[#27272a]'
          : 'text-[#919095] hover:text-[#e4e1e5] hover:bg-[#1b1b1e]'
      }`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {label}
    </button>
  );
};

interface TabBarProps {
  children: React.ReactNode;
}

export const TabBar = ({ children }: TabBarProps) => {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-[#0e0e11] border border-[#27272a] rounded-[6px] w-fit">
      {children}
    </div>
  );
};
