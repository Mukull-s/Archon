import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GithubGlyph } from './Substrate'
import { Wrap, Section, SectionHead, Serif, Stop, Eyebrow } from './primitives'

/* ══ EVIDENCE ═════════════════════════════════════════════════════════════
   The unusual part: the product says no more often than most tools. This
   section shows both outcomes as they actually render — a proven answer with
   its receipts, and a refusal with its reason.                              */
export function Evidence() {
  return (
    <Section id="evidence" recessed>
      <Wrap>
        <SectionHead
          eyebrow="The unusual part"
          tone="em"
          title={
            <>
              It is designed to say
              <br />
              <Serif>no</Serif> more often than most tools
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            Every confident wrong answer costs you more than a missing one. So when the evidence is
            thin, Archon stops. These are the actual shapes those two outcomes take.
          </p>
        </SectionHead>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          {/* ── proven ─────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-[4px] border border-rule bg-plate">
            <div className="flex items-center justify-between gap-4 border-b border-[#2b2e36] px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#a8adb6]">
                <i className="block h-1.5 w-1.5 rounded-full bg-emerald" />
                Proven · answered with receipts
              </div>
              <span className="rounded-[2px] border border-emerald/35 px-1.5 py-px font-mono text-[8px] tracking-[0.13em] text-mint">
                HIGH
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {[
                { f: 'services/impact.orchestrator.ts', lines: ['52', '53'] },
                { f: 'services/ast.service.ts', lines: ['673'] },
              ].map((receipt, i) => (
                <div key={receipt.f} className="overflow-hidden rounded-[3px] border border-[#2b2e36]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#23262d] px-3 py-2">
                    <span className="font-mono text-[10px] text-[#e6e9ee]">{receipt.f}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-mint">VERIFIED</span>
                  </div>
                  <div className="px-3 py-2 font-mono text-[10.5px] leading-[1.8] text-[#a8adb6]">
                    {i === 0 ? (
                      <>
                        <div>
                          <span className="mr-3 text-[#5c626d]">52</span>
                          const riskInfo = astService.computeImpactRisk(
                        </div>
                        <div>
                          <span className="mr-3 text-[#5c626d]">53</span>
                          {'  '}normalizedTarget, dependencyGraph, fileContent);
                        </div>
                      </>
                    ) : (
                      <div>
                        <span className="mr-3 text-[#5c626d]">673</span>
                        const riskScore = 0.6 * inDegree + 0.4 * maxDepth;
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <p className="mt-1 text-[12px] leading-[1.65] text-[#8b909a]">
                Two files, two lines. The claim “risk score 17.6” is reproducible from these two
                statements alone.
              </p>
            </div>
          </div>

          {/* ── withheld ───────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-[4px] border border-rule bg-plate">
            <div className="flex items-center justify-between gap-4 border-b border-[#2b2e36] px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.15em] text-[#a8adb6]">
                <i className="block h-1.5 w-1.5 rounded-full bg-[#ff8a76]" />
                Not proven · withheld, with the reason
              </div>
              <span className="rounded-[2px] border border-sig/30 px-1.5 py-px font-mono text-[8px] tracking-[0.13em] text-[#ff8a76]">
                AMBIGUOUS
              </span>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="rounded-[3px] border border-[#2b2e36] px-3.5 py-3">
                <div className="mb-2 font-mono text-[10.5px] text-[#8b909a]">
                  What does <b className="text-[#e6e9ee]">utils</b> export?
                </div>
                <div className="mb-2 text-[12px] leading-[1.6] text-[#a8adb6]">
                  There is no file named <b className="text-[#e6e9ee]">utils</b>. Two indexed files
                  share that segment.
                </div>
                <div className="font-mono text-[8.5px] uppercase tracking-[0.13em] text-[#686d78]">
                  2 candidates · not guessing
                </div>
              </div>
              <div className="font-mono text-[10px] leading-[2] text-[#9aa0ab]">
                <div>
                  <span className="text-[#ff8a76]">1 ·</span> server/src/utils/index.ts
                </div>
                <div>
                  <span className="text-[#ff8a76]">2 ·</span> client/src/utils/index.ts
                </div>
              </div>
              <p className="mt-1 text-[12px] leading-[1.65] text-[#7d838f]">
                The resolver returns <span className="text-[#c8cdd6]">AMBIGUOUS</span> with both
                paths attached. It will answer once you choose. It will not choose for you.
              </p>
            </div>
          </div>
        </div>
      </Wrap>
    </Section>
  )
}

/* ══ ENGINE ═══════════════════════════════════════════════════════════════
   The stack, drawn as line art. Five boxes left to right for one request, then
   three cards naming the actual mechanisms.                                 */
export function Engine() {
  const boxes = [
    { k: 'Source', v: 'GitHub zipball', m: ['public repos', 'or ZIP upload'] },
    { k: 'Structure', v: 'AST parser', m: ['TS compiler API', 'Python parser'], em: true },
    { k: 'Relations', v: 'Import graph', m: ['forward + reverse', 'adjacency'], em: true },
    { k: 'Storage', v: 'Postgres', m: ['chunks · graph', '+ pgvector HNSW'] },
    { k: 'Retrieval', v: 'Voyage embed', m: ['512-dim', 'symbol chunks'] },
  ]

  const cards = [
    {
      n: 'STRUCTURAL TRUTH',
      t: 'The graph decides',
      d: (
        <>
          Whether a dependency exists, how deep a cascade runs, which file is load-bearing, all
          resolved from parsed syntax. <b className="font-semibold text-ink">No model in that path.</b>
        </>
      ),
    },
    {
      n: 'RECALL',
      t: 'Symbol-aligned chunks',
      d: (
        <>
          Files are split along function and class boundaries up to{' '}
          <b className="font-semibold text-ink">4,800 characters</b>, with 500-character overlap, so
          retrieval returns an intact unit of code rather than an arbitrary window.
        </>
      ),
    },
    {
      n: 'PROVENANCE',
      t: 'Every answer carries its origin',
      d: (
        <>
          Responses are assembled with the file path and line range behind each statement, plus the
          list of steps the resolver executed to get there.{' '}
          <b className="font-semibold text-ink">The reasoning is inspectable.</b>
        </>
      ),
    },
  ]

  return (
    <Section id="engine">
      <Wrap>
        <SectionHead
          eyebrow="Under the hood"
          title={
            <>
              A normal stack, doing
              <br />
              abnormal <Serif>bookkeeping</Serif>
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            Nothing exotic. The difference is that the structural layer is treated as ground truth
            and the language layer is only allowed to describe it.
          </p>
        </SectionHead>

        <div className="overflow-hidden rounded-[4px] border border-rule bg-paper-2">
          <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
              Fig. 02 — <b className="font-medium text-ink-2">Indexing and retrieval path</b>
            </div>
            <div className="hidden font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-3 sm:block">
              SINGLE REQUEST · LEFT TO RIGHT
            </div>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {boxes.map((b, i) => (
                <div key={b.k} className="relative">
                  <div
                    className={`rounded-[3px] border px-3.5 py-3 ${b.em ? 'border-emerald/40 bg-emerald/[0.04]' : 'border-rule bg-white'}`}
                  >
                    <div className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.16em] text-ink-3">
                      {b.k}
                    </div>
                    <div className="mb-2 text-[12.5px] font-semibold tracking-[-0.02em] text-ink">
                      {b.v}
                    </div>
                    <div className="font-mono text-[8.5px] leading-[1.7] text-ink-3">
                      {b.m.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </div>
                  </div>
                  {i < boxes.length - 1 && (
                    <div className="pointer-events-none absolute -right-2.5 top-1/2 hidden -translate-y-1/2 font-mono text-[11px] text-rule-strong lg:block">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 border-t border-rule pt-7 md:grid-cols-3">
              {cards.map((c) => (
                <div key={c.n} className="border-t-2 border-emerald/40 pt-4">
                  <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.17em] text-emerald">
                    {c.n}
                  </div>
                  <div className="mb-2 text-[14px] font-semibold tracking-[-0.022em] text-ink">
                    {c.t}
                  </div>
                  <p className="text-[12.5px] leading-[1.62] text-ink-2">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Wrap>
    </Section>
  )
}

/* ══ LIMITS ═══════════════════════════════════════════════════════════════
   Stated plainly, on purpose. A tool that only advertises strengths is asking
   to be mistrusted. Every value here is an enforced constant.               */
export function Limits() {
  const limits = [
    {
      k: 'Scale ceiling',
      v: '400 files, 15 MB, per repository',
      d: (
        <>
          Larger repositories are truncated at the limit.{' '}
          <code className="rounded-[3px] border border-rule bg-ink/[0.055] px-1.5 py-px font-mono text-[11.5px]">
            MAX_FILES_LIMIT
          </code>{' '}
          is 400,{' '}
          <code className="rounded-[3px] border border-rule bg-ink/[0.055] px-1.5 py-px font-mono text-[11.5px]">
            MAX_TOTAL_SIZE_LIMIT
          </code>{' '}
          is 15 MB and{' '}
          <code className="rounded-[3px] border border-rule bg-ink/[0.055] px-1.5 py-px font-mono text-[11.5px]">
            MAX_SINGLE_FILE_SIZE_LIMIT
          </code>{' '}
          is 1 MB. The completion gate reports the index as{' '}
          <b className="font-semibold text-ink">incomplete</b> rather than pretending otherwise.
        </>
      ),
    },
    {
      k: 'Language coverage',
      v: 'TypeScript, JavaScript, Python',
      d: (
        <>
          Parsing is deep for these three. Other languages may be indexed as text but are{' '}
          <b className="font-semibold text-ink">not</b> structurally resolved, and Archon will not
          present them as if they were. No Java, Go or Rust AST today.
        </>
      ),
    },
    {
      k: 'Source scope',
      v: 'Public repositories and ZIP uploads',
      d: (
        <>
          Ingestion takes a public GitHub repository or an uploaded archive. A repository that
          cannot be downloaded (private, rate-limited or missing) returns a specific error, not a
          partial index.
        </>
      ),
    },
  ]

  return (
    <Section id="limits" tight>
      <Wrap>
        <SectionHead
          eyebrow="Honest limits"
          title={
            <>
              What it does <Serif>not</Serif> do
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            A tool that only advertises strengths is asking to be mistrusted. These are real,
            enforced constraints of the current build.
          </p>
        </SectionHead>

        <div className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {limits.map((l) => (
            <div key={l.k} className="grid grid-cols-1 items-baseline gap-3 border-b border-rule py-3.5 md:grid-cols-[1fr_auto] md:gap-3">
              <div className="text-[13.5px] font-medium text-ink">{l.k}</div>
              <div className="text-left font-mono text-[10px] tracking-[0.08em] text-emerald md:text-right">
                {l.v}
              </div>
              <p className="col-span-full mt-1 text-[12.5px] leading-[1.62] text-ink-3">{l.d}</p>
            </div>
          ))}
        </div>
      </Wrap>
    </Section>
  )
}

/* ══ FAQ ══════════════════════════════════════════════════════════════════
   Real questions with real answers. If something is missing here, it is more
   likely a real limit than an oversight.                                    */
export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  const items = [
    {
      q: 'Does a language model decide what depends on what?',
      a: [
        'No. Dependency resolution, blast radius, hop counts and risk scoring are computed from the parsed syntax trees and the resolved import graph. That path is deterministic and reproducible.',
        "The model's role is narrower: turning an already-resolved structural finding into a readable sentence, and reasoning over the retrieved chunks. If you disable it, the structural answers are unchanged. Only the prose changes.",
      ],
    },
    {
      q: 'What happens when it cannot answer?',
      a: [
        'It returns a typed non-answer rather than a filled-in guess. An unresolved filename yields NOT_FOUND. A name that matches more than one indexed file yields AMBIGUOUS with every candidate listed. A file that nothing imports yields NO_DEPENDENCY.',
        'Each of those carries a confidence band and the steps the resolver actually executed, so you can see where it stopped and why.',
      ],
    },
    {
      q: 'How is the blast radius calculated?',
      a: [
        'From the reverse graph. Archon collects every file that reaches the selected file, however indirectly, and records the shortest hop distance to each. In-degree is how many files import it directly; depth is the longest shortest-path in that cascade.',
        'The risk score is 0.6 × in-degree + 0.4 × depth. Below 2.0 is LOW, below 5.0 is MEDIUM, anything above is HIGH. Those numbers are the whole formula. Nothing is hidden.',
      ],
    },
    {
      q: 'Why is there a file limit?',
      a: [
        'Because embedding and parsing a repository is the expensive step, and an unbounded index is how a demo becomes a denial-of-service against itself. The current ceilings are 400 files, 15 MB total, and 1 MB per file.',
        'When a repository hits a ceiling, the pipeline marks the index incomplete and records the reason. You are told the index is partial. It is never silently presented as complete.',
      ],
    },
    {
      q: 'Can I run it on my own infrastructure?',
      a: [
        'Yes. The server is a Node/TypeScript service backed by PostgreSQL with the pgvector extension; the client is a React application. Both are ordinary builds with no proprietary hosting dependency.',
        'Ingestion accepts an uploaded ZIP alongside the GitHub path, which means the analysis flow does not require any outbound call to a repository host.',
      ],
    },
    {
      q: 'Is any of this a claim you cannot back up?',
      a: [
        'That is exactly the test this page was written to pass. Every capability above maps to a service in the codebase: the AST parser, the dependency intelligence service, the impact orchestrator, the confidence service, the evidence service.',
        'The numeric constants are defaults read from configuration, and the limits section lists them with their names. Where the product cannot do something, this page says so instead of staying quiet.',
      ],
    },
  ]

  return (
    <Section id="faq" recessed>
      <Wrap>
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[300px_1fr] lg:gap-14">
          <div>
            <Eyebrow tone="em">Questions</Eyebrow>
            <h2 className="mb-4 mt-5 text-[30px] font-semibold leading-[1.1] tracking-[-0.034em] text-ink md:text-[36px]">
              Direct
              <br />
              <Serif>answers</Serif>
              <Stop />
            </h2>
            <p className="text-[14px] leading-[1.68] text-ink-2">
              If something is missing here, it is more likely a real limit than an oversight.
            </p>
          </div>

          <div className="border-t border-rule-strong">
            {items.map((item, i) => {
              const isOpen = open === i
              return (
                <div key={item.q} className="border-b border-rule">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 py-4 text-left text-[14px] font-medium text-ink"
                  >
                    <span>{item.q}</span>
                    <span
                      className={`flex-none font-mono text-[13px] transition-transform duration-200 ${isOpen ? 'rotate-45 text-emerald' : 'text-ink-3'}`}
                    >
                      +
                    </span>
                  </button>
                  {/* the accordion uses max-height rather than grid-template-rows so
                      no inline style is needed to animate the open state */}
                  <div
                    className={`overflow-hidden transition-[max-height] duration-300 ease-[cubic-bezier(.22,.61,.36,1)] ${
                      isOpen ? 'max-h-[340px]' : 'max-h-0'
                    }`}
                  >
                    <div className="space-y-3 pb-4 pr-8">
                      {item.a.map((para, j) => (
                        <p key={j} className="text-[13px] leading-[1.68] text-ink-2">
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Wrap>
    </Section>
  )
}

/* ══ FINAL CTA ════════════════════════════════════════════════════════════
   One field, oversized type. The fastest way to judge the product is to ask it
   something ambiguous and watch it decline to guess.                        */
export function FinalCTA() {
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
    <Section id="access">
      <Wrap>
        <div className="relative overflow-hidden rounded-[4px] border border-rule-strong bg-paper-2 px-7 py-10 shadow-cta md:px-11">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(21,22,26,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(21,22,26,.022)_1px,transparent_1px)] bg-[length:28px_28px]"
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-1 items-center gap-7 lg:grid-cols-[1fr_auto] lg:gap-10">
            <div>
              <Eyebrow>Start here</Eyebrow>
              <h2 className="mb-3 mt-4 text-[26px] font-semibold leading-[1.1] tracking-[-0.034em] text-ink md:text-[32px]">
                Point it at a repository
                <br />
                and see what it <Serif>refuses</Serif>
                <Stop />
              </h2>
              <p className="max-w-[46ch] text-[14px] leading-[1.6] text-ink-2">
                The fastest way to judge this product is to ask it something ambiguous and watch it
                decline to guess.
              </p>
            </div>

            <div className="w-full lg:w-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  go(repo)
                }}
                className="flex items-center gap-2.5 rounded-[4px] border-[1.5px] border-rule-strong bg-white p-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-emerald focus-within:shadow-[0_0_0_3px_rgba(13,107,79,.09)]"
              >
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
                  className="w-full min-w-0 border-0 bg-transparent py-2 font-mono text-[12.5px] text-ink outline-none placeholder:text-[#a8a496] lg:w-[240px]"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-[2.5px] border-[1.5px] border-sig bg-sig px-[18px] py-[9px] text-[13.5px] font-semibold text-white transition-colors hover:border-[#c93a25] hover:bg-[#c93a25]"
                >
                  Analyze <span className="ml-1 inline-block opacity-70">→</span>
                </button>
              </form>
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
            </div>
          </div>
        </div>
      </Wrap>
    </Section>
  )
}
