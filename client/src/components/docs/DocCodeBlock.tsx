import React, { useState } from 'react';

interface DocCodeBlockProps {
  language?: string;
  code: string;
  filename?: string;
}

export default function DocCodeBlock({ language = 'typescript', code, filename }: DocCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div style={{
      margin: '20px 0',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      background: '#0d0d11',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '12px',
        color: '#a1a1aa',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            color: '#71717a',
            textTransform: 'uppercase',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}>
            {language}
          </span>
          {filename && (
            <>
              <span style={{ color: '#3f3f46' }}>/</span>
              <span style={{ color: '#e4e4e7', fontFamily: 'monospace' }}>{filename}</span>
            </>
          )}
        </div>

        <button
          onClick={handleCopy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: copied ? '#4ade80' : '#a1a1aa',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '3px 8px',
            borderRadius: '4px',
            transition: 'all 0.15s ease',
          }}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div style={{
        padding: '16px',
        overflowX: 'auto',
        fontSize: '13px',
        lineHeight: 1.6,
        color: '#e4e4e7',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      }}>
        <pre style={{ margin: 0 }}>
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
