import React from 'react';

interface DocCalloutProps {
  type?: 'note' | 'tip' | 'important' | 'warning';
  title?: string;
  children: React.ReactNode;
}

export default function DocCallout({ type = 'note', title, children }: DocCalloutProps) {
  const configs = {
    note: {
      border: 'rgba(176, 38, 255, 0.4)',
      bg: 'rgba(176, 38, 255, 0.04)',
      color: '#c084fc',
      defaultTitle: 'Note',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      )
    },
    tip: {
      border: 'rgba(34, 197, 94, 0.4)',
      bg: 'rgba(34, 197, 94, 0.04)',
      color: '#4ade80',
      defaultTitle: 'Tip',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      )
    },
    important: {
      border: 'rgba(59, 130, 246, 0.4)',
      bg: 'rgba(59, 130, 246, 0.04)',
      color: '#60a5fa',
      defaultTitle: 'Important',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      )
    },
    warning: {
      border: 'rgba(234, 179, 8, 0.4)',
      bg: 'rgba(234, 179, 8, 0.04)',
      color: '#facc15',
      defaultTitle: 'Warning',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      )
    }
  };

  const c = configs[type];

  return (
    <div style={{
      margin: '24px 0',
      padding: '16px 20px',
      borderRadius: '8px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderLeft: `4px solid ${c.color}`,
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: c.color,
        fontSize: '13px',
        fontWeight: 600,
        letterSpacing: '0.01em',
        marginBottom: '6px',
      }}>
        {c.icon}
        <span>{title || c.defaultTitle}</span>
      </div>
      <div style={{
        color: '#d4d4d8',
        fontSize: '14px',
        lineHeight: 1.65,
      }}>
        {children}
      </div>
    </div>
  );
}
