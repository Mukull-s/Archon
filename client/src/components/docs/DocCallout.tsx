import React from 'react';

interface DocCalloutProps {
  type?: 'note' | 'tip' | 'important' | 'warning';
  title?: string;
  children: React.ReactNode;
}

/**
 * Callouts.
 *
 * Four kinds, and the colour carries the meaning rather than decorating it:
 * note is neutral, tip is the engine's emerald, important is the amber used
 * everywhere else for "pay attention", warning is signal red for things that
 * can cost you data. No colour is used that is not already a token in the
 * Plate & Paper palette, so a callout never looks imported from another system.
 */
export default function DocCallout({ type = 'note', title, children }: DocCalloutProps) {
  const configs = {
    note: {
      border: 'var(--rule-strong)',
      bg: 'var(--paper-3)',
      color: 'var(--ink-2)',
      defaultTitle: 'Note',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
        </svg>
      ),
    },
    tip: {
      border: 'rgba(13,107,79,.34)',
      bg: 'rgba(13,107,79,.055)',
      color: 'var(--emerald)',
      defaultTitle: 'Tip',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
        </svg>
      ),
    },
    important: {
      border: 'rgba(184,122,18,.34)',
      bg: 'rgba(184,122,18,.055)',
      color: 'var(--amber)',
      defaultTitle: 'Important',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
    },
    warning: {
      border: 'rgba(226,70,47,.34)',
      bg: 'rgba(226,70,47,.055)',
      color: 'var(--signal)',
      defaultTitle: 'Warning',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 2 20h20L12 3Z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
      ),
    },
  };

  const cfg = configs[type] ?? configs.note;

  return (
    <div
      className="my-5 flex gap-3 rounded-[3px] border px-4 py-3.5"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <span className="mt-px flex-none" style={{ color: cfg.color }} aria-hidden="true">
        {cfg.icon}
      </span>
      <div className="min-w-0">
        <div
          className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em]"
          style={{ color: cfg.color }}
        >
          {title || cfg.defaultTitle}
        </div>
        <div className="text-[13.5px] leading-[1.68] text-ink-2 [&_a]:text-emerald [&_a]:underline [&_code]:rounded-[2px] [&_code]:bg-paper-3 [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-ink [&_p]:m-0 [&_p+p]:mt-2">
          {children}
        </div>
      </div>
    </div>
  );
}