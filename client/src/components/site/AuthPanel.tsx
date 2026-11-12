import { Link } from 'react-router-dom'

/**
 * AuthBrandPanel — the left half of the auth screen.
 *
 * Deliberately quiet. An auth page has exactly one job: get the form filled.
 * Anything on the left that competes with that is a liability, not a feature.
 *
 * The previous version drew an interactive node mesh here. It was removed
 * because:
 *   • a canvas of moving points behind body copy measurably reduces the
 *     readable contrast of the copy itself
 *   • interactivity on a sign-in screen asks for attention the user has not
 *     offered yet, which reads as trying too hard
 *   • the strongest auth pages are near-empty; the restraint is the signal
 *
 * What replaces it is a static plate in the same material language as the rest
 * of the site: the paper/plate tokens, one hairline instrument diagram of the
 * real pipeline, and three figures that trace to real constants. No motion, no
 * pointer tracking, no canvas. It is a title page, not a toy.
 *
 * The one piece of the old design worth keeping was the *idea* that Archon
 * resolves the unresolved — so that idea is now stated in words and in a static
 * diagram, where it can be read instead of chased.
 */

/** A static, hairline diagram of the resolve pipeline. No animation. */
function PipelineDiagram() {
  const stages = [
    { k: 'PARSE', v: 'every file', n: '400' },
    { k: 'RESOLVE', v: 'import graph', n: '1,180' },
    { k: 'INDEX', v: 'symbol chunks', n: '2,149' },
    { k: 'ANSWER', v: 'cited', n: 'yes or no' },
  ]

  return (
    <div className="mb-9" aria-hidden="true">
      {/* one continuous rail behind the four stage marks, so the ticks sit ON
          the line rather than floating above their own segment */}
      <div className="relative">
        <div className="absolute inset-x-0 top-[3px] h-px bg-[#2b2e36]" />

        <div className="relative grid grid-cols-4">
          {stages.map((s, i) => (
            <div key={s.k} className="min-w-0">
              <span
                className={`block h-[7px] w-[7px] rounded-full ${
                  i === stages.length - 1 ? 'bg-mint' : 'border border-[#4a5060] bg-plate'
                }`}
              />
              <div className="mt-3 pr-3 font-mono text-[7.5px] uppercase tracking-[0.18em] text-[#5c626d]">
                {s.k}
              </div>
              <div className="mt-1.5 pr-3 font-mono text-[9.5px] leading-tight text-[#8b909a]">
                {s.v}
              </div>
              <div className="mt-1 pr-3 font-mono text-[10px] font-medium text-[#c8cdd6]">{s.n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AuthBrandPanel() {
  const facts = [
    { k: 'Engine', v: 'Deterministic AST' },
    { k: 'Retrieval', v: 'voyage-code-4 · 512-dim' },
    { k: 'When unsure', v: 'It declines' },
  ]

  return (
    <div className="relative hidden overflow-hidden bg-plate lg:flex lg:min-h-screen lg:flex-1">
      {/* A single ruled grid and one light direction — the same substrate
          grammar as the rest of the site, at low contrast so text stays
          dominant. No canvas, no motion. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.022)_1px,transparent_1px)] bg-[length:64px_64px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_700px_at_18%_8%,rgba(37,208,160,.045),transparent_60%),radial-gradient(800px_600px_at_92%_96%,rgba(226,70,47,.022),transparent_62%)]"
        aria-hidden="true"
      />

      <div className="relative z-[2] flex w-full flex-col p-12 xl:p-16">
        {/* ── brand ─────────────────────────────────────────────────────── */}
        <Link to="/" className="mb-20 inline-flex items-center gap-2.5 focus-visible:outline-none xl:mb-24">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-mint" aria-hidden="true">
            <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="1.65" fill="currentColor" />
          </svg>
          <span className="text-[17px] font-semibold tracking-[-0.025em] text-[#f0f3f6]">Archon</span>
        </Link>

        {/* ── the claim ─────────────────────────────────────────────────── */}
        <div className="max-w-[440px]">
          <div className="mb-5 flex items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.19em] text-[#6b7078]">
            <span className="h-px w-6 bg-mint" />
            Codebase intelligence
          </div>

          <h1 className="mb-5 text-[40px] font-semibold leading-[1.05] tracking-[-0.038em] text-[#f0f3f6]">
            Every answer
            <br />
            <em className="font-serif italic font-normal tracking-[-0.012em] text-mint">cites</em> its source
            <span className="text-[#ff8a76]">.</span>
          </h1>

          <p className="mb-9 max-w-[40ch] text-[14px] leading-[1.7] text-[#8b909a]">
            Archon reads every file with a deterministic AST engine, resolves the import
            graph, and answers with file-and-line evidence. When it cannot prove an answer,
            it says so.
          </p>

          <PipelineDiagram />

          <div className="border-t border-[#262932]">
            {facts.map((f) => (
              <div key={f.k} className="flex items-baseline justify-between gap-6 border-b border-[#262932] py-2.5">
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#5c626d]">
                  {f.k}
                </span>
                <span className="font-mono text-[10.5px] text-[#c8cdd6]">{f.v}</span>
              </div>
            ))}
          </div>

          {/* the closing line belongs with the content, not pinned to the floor */}
          <p className="mt-6 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#4f545e]">
            Self-hostable · Postgres + pgvector
          </p>
        </div>

        <div className="flex-1" />
      </div>

      {/* one bright edge, matching the footer plate */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[linear-gradient(180deg,transparent,rgba(37,208,160,.28)_30%,rgba(37,208,160,.28)_70%,transparent)]"
        aria-hidden="true"
      />
    </div>
  )
}
