import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GithubGlyph } from './Substrate'
export function Hero() {
  const [repo, setRepo] = useState('')
  const navigate = useNavigate()

  const go = (value: string) => {
    const slug = value.trim()
    if (!slug) return
    navigate(`/dashboard?repo=${encodeURIComponent(slug)}`)
  }

  const TRIES = [
    { label: 'vercel/next.js', slug: 'github.com/vercel/next.js' },
    { label: 'expressjs/express', slug: 'github.com/expressjs/express' },
    { label: 'fastapi/fastapi', slug: 'github.com/fastapi/fastapi' },
  ]

  return (
    <header className="relative z-[2] pt-11 md:pt-16">
      <div className="relative z-[2] mx-auto grid w-full max-w-site grid-cols-1 items-start gap-11 px-6 md:px-10 lg:grid-cols-[minmax(0,588px)_1fr] lg:gap-16 lg:px-14">
        {/* ── the claim ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-center gap-3 font-mono text-eyebrow uppercase text-ink-3">
            <span className="h-px w-6 bg-emerald" />
            Codebase intelligence
          </div>

          <h1 className="mb-6 text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] text-ink md:text-display">
            Every claim
            <br />
            <em className="font-serif italic font-normal tracking-[-0.012em]">measured,</em> never guessed
            <span className="text-sig">.</span>
          </h1>

          <p className="mb-6 max-w-[50ch] text-base leading-[1.66] text-ink-2">
            Paste a public GitHub repository or upload a ZIP. Archon reads every file with a
            deterministic AST engine, resolves the import graph, and answers with{' '}
            <b className="font-semibold text-ink">file-and-line evidence</b>. When it cannot prove
            an answer, it says so.
          </p>

          <form
            className="mb-8"
            onSubmit={(e) => {
              e.preventDefault()
              go(repo)
            }}
          >
            <div className="flex items-center gap-2.5 rounded-[4px] border-[1.5px] border-rule-strong bg-white p-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(13,107,79,.09)]">
              <span className="flex-none text-ink-3">
                <GithubGlyph />
              </span>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                placeholder="github.com/owner/repository"
                aria-label="GitHub repository URL"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 font-mono text-[12.5px] text-ink outline-none placeholder:text-[#a8a496]"
              />
              <button
                type="submit"
                className="rounded-[2.5px] border-[1.5px] border-forest bg-forest px-[18px] py-[9px] text-[13.5px] font-semibold text-[#f0f6f2] transition-colors hover:bg-[#0c2a23]"
              >
                Analyze
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <em className="font-mono text-[9px] not-italic uppercase tracking-[0.15em] text-ink-3">
                Try
              </em>
              {TRIES.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setRepo(t.slug)}
                  className="border-b border-rule-strong pb-px font-mono text-[10.5px] text-ink-2 transition-colors hover:border-emerald hover:text-emerald"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </form>

          <div className="border-t border-rule">
            {[
              { n: '01', t: 'Parse everything', d: <>TypeScript and Python ASTs. <b className="font-semibold text-ink-2">Nothing sampled.</b></> },
              { n: '02', t: 'Resolve the graph', d: <>Every import edge traced, forward and in reverse.</> },
              { n: '03', t: 'Cite or refuse', d: <>Each answer carries <b className="font-semibold text-ink-2">a file, a line and a confidence band</b>.</> },
              { n: '04', t: 'Surface ambiguity', d: <>Two files match? It asks you. It does not pick one.</> },
            ].map((row) => (
              <div
                key={row.n}
                className="grid grid-cols-[px28_1fr] items-baseline gap-x-2.5 gap-y-0.5 border-b border-rule py-3 md:grid-cols-[34px_172px_1fr] md:gap-y-0"
              >
                <span className="font-mono text-[9.5px] tracking-[0.13em] text-ink-3">{row.n}</span>
                <span className="text-[13px] font-semibold text-ink">{row.t}</span>
                <span className="col-start-2 text-[12.5px] leading-[1.5] text-ink-3 md:col-start-3">
                  {row.d}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── the plate ─────────────────────────────────────────────── */}
        <div className="relative w-full max-w-[760px] pt-1.5">
          <div className="mb-3 text-right font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
            Fig. 01 — <b className="font-medium text-ink-2">Blast radius, computed not estimated</b>
          </div>
          <BlastRadiusPlate />
        </div>
      </div>
    </header>
  )
}

/**
 * The blast-radius instrument.
 *
 * Hand-authored SVG with the real shape of the data: a central origin, one ring
 * of direct dependents on the emerald spokes, a dimmer second ring for the
 * cascade, and one red node marking the high-fan-in route. The callout carries
 * figures that match the figures in the spec strip below it.
 */
function BlastRadiusPlate() {
  return (
    <figure className="relative overflow-hidden rounded-[4px] bg-plate shadow-plate">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.028)_1px,transparent_1px)] bg-[length:34px_34px]"
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between gap-4 border-b border-[#2b2e36] px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.15em] text-[#686d78]">
        <div className="flex items-center gap-2 text-[#a8adb6]">
          <i className="block h-[5px] w-[5px] animate-pulse-dot rounded-full bg-mint shadow-[0_0_0_3px_rgba(37,208,160,.14)]" />
          <b className="font-medium tracking-[0.15em] text-[#e6e9ee]">IMPACT ANALYSIS</b> · SELECTED FILE
        </div>
        <div className="hidden sm:block">DEPENDENCY GRAPH · REVERSE TRAVERSAL</div>
      </div>

      <div className="relative">
        <svg viewBox="0 0 620 340" preserveAspectRatio="xMidYMid meet" className="h-auto w-full" aria-hidden="true">
          <line x1="0" y1="170" x2="620" y2="170" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
          <line x1="310" y1="0" x2="310" y2="340" stroke="rgba(255,255,255,.10)" strokeWidth="1" />

          <circle cx="310" cy="170" r="150" fill="none" stroke="rgba(255,255,255,.10)" />
          <circle cx="310" cy="170" r="104" fill="none" stroke="rgba(37,208,160,.34)" strokeDasharray="4 5" />
          <circle cx="310" cy="170" r="56" fill="none" stroke="rgba(255,255,255,.20)" />

          <g strokeLinecap="round">
            <line x1="310" y1="170" x2="389" y2="118" stroke="rgba(37,208,160,.62)" />
            <line x1="310" y1="170" x2="412" y2="188" stroke="rgba(37,208,160,.5)" />
            <line x1="310" y1="170" x2="328" y2="234" stroke="rgba(37,208,160,.52)" />
            <line x1="310" y1="170" x2="246" y2="110" stroke="rgba(37,208,160,.46)" />
            <line x1="310" y1="170" x2="234" y2="192" stroke="rgba(37,208,160,.5)" />
            <line x1="310" y1="170" x2="266" y2="242" stroke="rgba(37,208,160,.4)" />
            <line x1="310" y1="170" x2="212" y2="152" stroke="rgba(37,208,160,.36)" />
            <line x1="389" y1="118" x2="430" y2="88" stroke="rgba(255,255,255,.14)" />
            <line x1="412" y1="188" x2="452" y2="208" stroke="rgba(255,255,255,.13)" />
            <line x1="246" y1="110" x2="196" y2="80" stroke="rgba(255,255,255,.13)" />
            <line x1="234" y1="192" x2="188" y2="208" stroke="rgba(255,255,255,.12)" />
            <line x1="328" y1="234" x2="360" y2="276" stroke="rgba(255,255,255,.12)" />
          </g>

          <g>
            <circle cx="310" cy="170" r="5.5" fill="#25d0a0" />
            <circle cx="310" cy="170" r="11" fill="none" stroke="rgba(37,208,160,.45)" />
            <circle cx="389" cy="118" r="4.5" fill="#25d0a0" />
            <circle cx="412" cy="188" r="4" fill="#25d0a0" />
            <circle cx="328" cy="234" r="4.5" fill="#25d0a0" />
            <circle cx="246" cy="110" r="4" fill="#e2462f" />
            <circle cx="234" cy="192" r="4.5" fill="#25d0a0" />
            <circle cx="266" cy="242" r="3.5" fill="#25d0a0" />
            <circle cx="212" cy="152" r="3.5" fill="#25d0a0" />
            <circle cx="430" cy="88" r="3" fill="#b9c0cb" />
            <circle cx="452" cy="208" r="3" fill="#b9c0cb" />
            <circle cx="196" cy="80" r="3" fill="#b9c0cb" />
            <circle cx="188" cy="208" r="3" fill="#b9c0cb" />
            <circle cx="360" cy="276" r="3" fill="#b9c0cb" />
            <circle cx="474" cy="150" r="3" fill="#b9c0cb" />
            <circle cx="164" cy="124" r="3" fill="#b9c0cb" />
            <circle cx="486" cy="242" r="3" fill="#b9c0cb" />
          </g>
        </svg>

        <div className="pointer-events-none absolute left-4 top-3.5 font-mono text-mono-micro uppercase text-[#5c626d]">
          ORIGIN · ROUTE MODULE
        </div>
        <div className="pointer-events-none absolute right-4 top-3.5 hidden font-mono text-mono-micro uppercase text-[#5c626d] sm:block">
          1 HOP · 26 FILES
        </div>
        <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-mono-micro uppercase text-[#5c626d]">
          2+ HOPS · CASCADE
        </div>

        <div className="absolute bottom-4 right-4 min-w-[184px] rounded-[3px] border border-[#2b2e36] bg-plate/95 px-3 py-2.5 backdrop-blur-sm">
          <div className="mb-1.5 font-mono text-mono-micro uppercase text-[#686d78]">Blast radius</div>
          <div className="flex items-baseline gap-1.5 text-[25px] font-semibold leading-none tracking-[-0.03em] text-[#e9ecf1]">
            <b>59</b>
            <em className="font-mono text-[8.5px] not-italic uppercase tracking-[0.13em] text-[#686d78]">
              files
            </em>
          </div>
          <div className="mt-2 font-mono text-[8.5px] leading-[1.65] text-[#8b909a]">
            cascade depth 5 · <u className="text-[#ff8a76] no-underline">0 routes exposed</u>
            <br />
            risk score 17.6 · HIGH
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-2 border-t border-[#2b2e36] md:grid-cols-4">
        {[
          { k: 'Selected file', v: 'types/index.ts' },
          { k: 'Direct dependents', v: '26', s: 'files' },
          { k: 'Cascade depth', v: '5', s: 'hops' },
          { k: 'Method', v: 'AST', s: 'resolved', mint: true },
        ].map((spec, i) => (
          <div
            key={spec.k}
            className={[
              'px-3.5 py-2.5',
              i % 2 === 0 ? 'border-r border-[#23262d]' : '',
              i < 2 ? 'border-b border-[#23262d] md:border-b-0' : '',
              i === 1 ? 'md:border-r' : '',
              i === 3 ? 'md:border-r-0' : '',
            ].join(' ')}
          >
            <div className="mb-1.5 font-mono text-[7px] uppercase tracking-[0.16em] text-[#686d78]">
              {spec.k}
            </div>
            <div
              className={`flex items-baseline gap-1 text-[12px] font-semibold tracking-[-0.015em] ${spec.mint ? 'text-mint' : 'text-[#e6e9ee]'}`}
            >
              {spec.v}
              {spec.s && (
                <small className="font-mono text-mono-micro font-normal tracking-[0.1em] text-[#686d78]">
                  {spec.s}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
    </figure>
  )
}
