import type { ReactNode } from 'react'

/**
 * Section-level primitives.
 *
 * Small, composable, Tailwind-only. Every landing section is assembled from
 * these rather than re-declaring its own container, eyebrow and heading — the
 * reason the old landing drifted visually was that each of its 11 components
 * redefined "a section" slightly differently.
 */

/** The content container. One width, one gutter, everywhere. */
export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative z-[2] mx-auto w-full max-w-site px-6 md:px-10 lg:px-14 ${className}`}>
      {children}
    </div>
  )
}

/** A full-width section band with an optional recessed paper background. */
export function Section({
  id,
  children,
  recessed = false,
  tight = false,
}: {
  id?: string
  children: ReactNode
  recessed?: boolean
  tight?: boolean
}) {
  return (
    <section
      id={id}
      className={[
        'relative z-[2]',
        tight ? 'py-16' : 'py-16 md:py-24',
        recessed ? 'bg-paper-2 border-y border-rule' : '',
      ].join(' ')}
    >
      {children}
    </section>
  )
}

/**
 * The mono eyebrow with its leading rule. `tone="em"` switches the rule to
 * emerald, used to mark sections carrying a claim rather than context.
 */
export function Eyebrow({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'em' }) {
  return (
    <div className="mb-4 flex items-center gap-3 font-mono text-eyebrow font-normal uppercase text-ink-3">
      <span className={tone === 'em' ? 'h-px w-6 bg-emerald' : 'h-px w-6 bg-rule-strong'} />
      {children}
    </div>
  )
}

/** A section heading at the editorial scale. */
export function SectionTitle({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={`text-[32px] leading-[1.08] tracking-[-0.036em] font-semibold text-ink md:text-sec ${className}`}>
      {children}
    </h2>
  )
}

/** The serif-italic accent used inside headings. */
export function Serif({ children }: { children: ReactNode }) {
  return <em className="font-serif italic font-normal tracking-[-0.012em]">{children}</em>
}

/** The red full stop that closes a headline sentence. */
export function Stop() {
  return <span className="text-sig">.</span>
}

/** The section sub-paragraph. */
export function Lede({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`max-w-[58ch] text-[15px] leading-[1.68] text-ink-2 ${className}`}>{children}</p>
  )
}

/** The standard section header block: eyebrow, title, lede. */
export function SectionHead({
  eyebrow,
  tone,
  title,
  children,
  className = '',
}: {
  eyebrow: ReactNode
  tone?: 'ink' | 'em'
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-10 max-w-[720px] md:mb-12 ${className}`}>
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
      <SectionTitle className="mb-4">{title}</SectionTitle>
      {children}
    </div>
  )
}

/** A small uppercase mono chip. */
export function Chip({
  children,
  tone = 'ink',
}: {
  children: ReactNode
  tone?: 'ink' | 'mint' | 'sig'
}) {
  const toneClass =
    tone === 'mint'
      ? 'border-emerald/35 text-emerald'
      : tone === 'sig'
        ? 'border-sig/30 text-sig'
        : 'border-rule-strong text-ink-3'
  return (
    <span
      className={`whitespace-nowrap rounded-[2px] border px-1.5 py-[3px] font-mono text-[8px] uppercase tracking-[0.13em] ${toneClass}`}
    >
      {children}
    </span>
  )
}
