/**
 * The substrate — the answer to "not just a colour".
 *
 * Five fixed layers sit behind all content and are pointer-transparent:
 *   grain → fibre → grid → press → tone
 *
 * They are defined in index.css rather than as Tailwind classes because each
 * is a multi-layer background stack or an SVG data-URI turbulence. Nothing
 * else on the site uses a raw class like this; everything else is utilities.
 *
 * Rendered once at the top of the site layout. Because it is `fixed` it
 * survives any scroll length with no tile seams, and `aria-hidden` keeps it
 * out of the accessibility tree.
 */
export function Substrate() {
  return (
    <div className="substrate" aria-hidden="true">
      <div className="sub__grain" />
      <div className="sub__fibre" />
      <div className="sub__grid" />
      <div className="sub__press" />
      <div className="sub__tone" />
      <div className="sub__margin sub__margin--l" />
      <div className="sub__margin sub__margin--r" />
    </div>
  )
}

/**
 * The Archon mark: a hollow double-diamond rosette with an X-bolt centre.
 * Four arms rotated 90° about (12,12).
 */
export function ArchonMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="1.65" fill="currentColor" />
    </svg>
  )
}

/** The GitHub glyph, used only as the icon inside a repository field. */
export function GithubGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  )
}
