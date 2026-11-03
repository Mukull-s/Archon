import React, { useState } from 'react';

interface DocCodeBlockProps {
  language?: string;
  code: string;
  filename?: string;
}

/**
 * Code blocks.
 *
 * Code is always printed on the plate, never on paper — it is the one thing in
 * the system that is a surface rather than a statement. So the block reuses the
 * Explorer's `.viewer` shell and sits its header on `.viewer__tabs`, which keeps
 * a README snippet and the product's own code viewer reading as one material.
 *
 * The copy affordance is a plate-side ghost button: emerald when the copy
 * landed, the plate's muted ink when it has not.
 */
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
    <div className="viewer my-5 rounded-[4px] border border-plate-3">
      {/* Header bar */}
      <div className="viewer__tabs justify-between">
        <div className="flex min-w-0 items-center">
          <span className="vtab border-r-0">{language}</span>
          {filename && (
            <>
              <span className="font-mono text-[11px] text-[#4f545e]">/</span>
              <span className="ml-2 truncate font-mono text-[11px] text-[#e6e9ee]">{filename}</span>
            </>
          )}
        </div>

        <button
          onClick={handleCopy}
          className={`mr-3 flex items-center gap-1.5 rounded-[3px] border border-transparent px-2 py-1 font-mono text-[11px] transition-colors ${
            copied ? 'text-mint' : 'text-[#82868f] hover:border-plate-3 hover:text-[#c8cdd6]'
          }`}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="vcode px-4">
        <pre className="m-0">
          <code>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
