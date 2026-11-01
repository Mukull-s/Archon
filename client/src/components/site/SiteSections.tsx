import { useState } from 'react'
import { Wrap, Section, SectionHead, Serif, Stop, Chip } from './primitives'

/* ══ TRUST STRIP ══════════════════════════════════════════════════════════
   Four verifiable product facts. No logos, no invented social proof — every
   value here is a real property of the system.                              */
export function TrustStrip() {
  const items = [
    { k: 'Parsing engine', v: 'Deterministic', s: 'AST' },
    { k: 'Languages', v: 'TS · JS · Python' },
    { k: 'Retrieval', v: 'Voyage', s: '512-dim' },
    { k: 'Answer mode', v: 'Cites or refuses' },
    { k: 'Deployment', v: 'Self-hostable', s: 'Postgres + pgvector' },
  ]
  return (
    <div className="relative z-[2] mx-auto mt-14 w-full max-w-site px-6 md:px-10 lg:px-14">
      <div className="grid grid-cols-2 overflow-hidden rounded-[4px] border-y border-rule border-t-rule-strong md:grid-cols-5">
        {items.map((item, i) => (
          <div
            key={item.k}
            className={[
              'py-4',
              i > 0 ? 'md:border-l md:border-rule md:pl-5' : '',
              i % 2 === 1 ? 'border-l border-rule pl-4 md:pl-5' : '',
              i >= 2 ? 'border-t border-rule md:border-t-0' : '',
              i === 2 ? 'md:pl-5' : '',
            ].join(' ')}
          >
            <div className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-3">
              {item.k}
            </div>
            <div className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em] text-ink">
              {item.k === 'Deployment' && (
                <i className="block h-[5px] w-[5px] rounded-full bg-mint shadow-[0_0_0_3px_rgba(37,208,160,.13)]" />
              )}
              {item.v}
              {item.s && (
                <span className="font-mono text-[9px] font-normal tracking-[0.06em] text-ink-3">
                  {item.s}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ THESIS ═══════════════════════════════════════════════════════════════
   The problem, stated as a direct contrast: the usual failure mode against
   Archon's contract. This is the section that argues for the product.       */
export function Thesis() {
  const bad = [
    <>Summarises the <b className="font-semibold">README</b> and calls it architecture.</>,
    <>Greps for a filename and reports it as a <b className="font-semibold">dependency</b>.</>,
    <>Picks one of two matching symbols without saying so.</>,
    <>States a blast radius you have no way to check.</>,
    <>Skips large files, then describes the repo as if it read them.</>,
  ]
  const good = [
    <>Parses <b className="font-semibold">every supported file</b> into a syntax tree, 400 files by default.</>,
    <>Resolves import edges into a <b className="font-semibold">navigable graph</b> you can traverse both ways.</>,
    <>Returns <b className="font-semibold">HIGH, MEDIUM or LOW</b> confidence, with the steps it executed.</>,
    <>On an ambiguous name, it lists the candidates and asks you.</>,
    <>Every impact claim ships with a <b className="font-semibold">file path and line range</b>.</>,
  ]

  return (
    <Section id="thesis">
      <Wrap>
        <SectionHead
          eyebrow="The problem"
          title={
            <>
              Code assistants are confident.
              <br />
              Codebases are <Serif>literal</Serif>
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            An assistant that guesses at your architecture costs you a review cycle, a broken
            import and a shipped regression. Archon runs on the opposite assumption:{' '}
            <b className="font-semibold text-ink">
              an answer that cannot be traced to a line of code should not be stated.
            </b>
          </p>
        </SectionHead>

        <div className="grid grid-cols-1 gap-9 lg:grid-cols-2 lg:gap-16">
          <FailureColumn
            tag="The usual failure mode"
            title="Plausible, unfalsifiable answers"
            marker="✕"
            tone="sig"
            items={bad}
          />
          <FailureColumn
            tag="Archon's contract"
            title="Traceable, or withheld"
            marker="✓"
            tone="em"
            items={good}
          />
        </div>
      </Wrap>
    </Section>
  )
}

function FailureColumn({
  tag,
  title,
  marker,
  tone,
  items,
}: {
  tag: string
  title: string
  marker: string
  tone: 'sig' | 'em'
  items: React.ReactNode[]
}) {
  return (
    <div>
      <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.17em] text-ink-3">{tag}</div>
      <h3 className="mb-5 text-[21px] font-semibold tracking-[-0.028em] text-ink">{title}</h3>
      <div className="border-t border-rule">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[22px_1fr] gap-3 border-b border-rule py-3">
            <span className={`font-mono text-[13px] ${tone === 'sig' ? 'text-sig' : 'text-emerald'}`}>
              {marker}
            </span>
            <span className="text-[13.5px] leading-[1.6] text-ink-2">{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══ METHOD ═══════════════════════════════════════════════════════════════
   Four deterministic stages, drawn as line-art diagrams of the actual model.
   Every meta line names a real constant or a real engine.                   */
export function Method() {
  const stages = [
    {
      n: 'STAGE 01',
      t: 'Ingest & extract',
      d: (
        <>
          Downloads the repository zipball from GitHub, or accepts a ZIP upload. Bounded before
          anything is parsed: <b className="font-semibold text-ink">400 files</b>, 15 MB total, 1 MB
          per file. Binary assets are skipped by extension.
        </>
      ),
      meta: [['SOURCE', 'GitHub zipball / ZIP upload'], ['CEILING', '400 files · 15 MB'], ['DOWNLOAD', '30s timeout, 1 retry']],
      icon: (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink">
          <rect x="3.5" y="4.5" width="23" height="21" rx="2.5" />
          <path d="M3.5 10.5h23M8 7.5h.01M11 7.5h.01" />
          <path d="M9 15h12M9 19h8" />
        </svg>
      ),
    },
    {
      n: 'STAGE 02',
      t: 'Parse to syntax trees',
      d: (
        <>
          TypeScript and JavaScript go through the TypeScript compiler API; Python through a
          dedicated indentation-aware parser. Each file yields its imports, exports, functions and
          classes. <b className="font-semibold text-ink">Structure, not text search.</b>
        </>
      ),
      meta: [['ENGINE', 'TypeScript compiler API'], ['PYTHON', 'indentation-aware parser'], ['YIELDS', 'imports · exports · symbols']],
      icon: (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink">
          <path d="M12 3.2 15 6.2 12 9.2 9 6.2Z" />
          <path d="M6 12.5 9 15.5 6 18.5 3 15.5Z" />
          <path d="M24 12.5 27 15.5 24 18.5 21 15.5Z" />
          <path d="M12 21.5 15 24.5 12 27.5 9 24.5Z" />
          <path d="M15 15.5 21 15.5M9 15.5 15 15.5M15 15.5V9.2M15 15.5V21.8" />
        </svg>
      ),
    },
    {
      n: 'STAGE 03',
      t: 'Resolve the graph',
      d: (
        <>
          Import specifiers are matched to real files. Extensions are inferred, parent directories
          reconstructed, cycles tolerated. The graph is stored in both directions, so “what breaks
          if I change this” is a lookup.
        </>
      ),
      meta: [['FORWARD', 'what does X import'], ['REVERSE', 'what imports X'], ['OUTPUT', 'adjacency, both ways']],
      icon: (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink">
          <circle cx="15" cy="15" r="3.4" />
          <circle cx="6" cy="7" r="2.2" />
          <circle cx="24" cy="8" r="2.2" />
          <circle cx="7" cy="24" r="2.2" />
          <circle cx="23" cy="23" r="2.2" />
          <path d="M12.6 12.4 7.6 8.6M17.6 13.4 22 9.6M12.9 17.6 8.7 22.4M17.2 17.3 21.5 21.7" />
        </svg>
      ),
    },
    {
      n: 'STAGE 04',
      t: 'Answer under evidence',
      d: (
        <>
          Files are chunked along symbol boundaries rather than fixed windows, then embedded, so a
          question can find the right function. Every response is assembled with the file and line
          it came from.
        </>
      ),
      meta: [['CHUNKING', 'symbol-aligned'], ['BUDGET', '4,800 chars, 500 overlap'], ['CITATION', 'file + start/end line']],
      icon: (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink">
          <path d="M5 25 25 5" />
          <path d="M17.5 5H25v7.5" />
          <circle cx="7.5" cy="22.5" r="2.6" />
        </svg>
      ),
    },
  ]

  return (
    <Section id="method" recessed>
      <Wrap>
        <SectionHead
          eyebrow="The method"
          tone="em"
          title={
            <>
              Four deterministic stages.
              <br />
              No step is <Serif>probabilistic</Serif>
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            A language model phrases what the graph already proved. It never decides what the graph
            says. The structural answer comes from parsed code, so the same input gives the same
            answer twice.
          </p>
        </SectionHead>

        <div className="grid grid-cols-1 border-t border-rule-strong md:grid-cols-2 lg:grid-cols-4">
          {stages.map((s, i) => (
            <div
              key={s.n}
              className={[
                'border-b border-rule px-0 py-6 lg:px-6 lg:first:pl-0',
                i > 0 ? 'lg:border-l lg:border-rule' : '',
              ].join(' ')}
            >
              <div className="mb-3.5 font-mono text-[9px] uppercase tracking-[0.17em] text-emerald">
                {s.n}
              </div>
              <div className="mb-4">{s.icon}</div>
              <div className="mb-2.5 text-[15px] font-semibold tracking-[-0.022em] text-ink">{s.t}</div>
              <p className="mb-4 text-[12.5px] leading-[1.62] text-ink-2">{s.d}</p>
              <div className="font-mono text-[8.5px] leading-[1.9] tracking-[0.06em] text-ink-3">
                {s.meta.map(([k, v]) => (
                  <div key={k}>
                    {k} <span className="text-ink-2">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Wrap>
    </Section>
  )
}

/* ══ CAPABILITIES ═════════════════════════════════════════════════════════
   The five questions as ONE instrument: a numbered index rail on the left and
   a single stage on the right that swaps. The previous version stacked five
   identical text/screenshot halves, which was the actual problem.           */
export function Capabilities() {
  const [active, setActive] = useState('dependency')

  const PANELS = [
    { id: 'dependency', n: '01', label: 'Dependency', q: 'Does A reach B?' },
    { id: 'impact', n: '02', label: 'Impact', q: 'What breaks if I edit this?' },
    { id: 'flow', n: '03', label: 'Execution flow', q: 'How does a request travel?' },
    { id: 'architecture', n: '04', label: 'Architecture', q: 'How is the system shaped?' },
    { id: 'assistant', n: '05', label: 'Assistant', q: 'Can I just ask it?' },
  ]

  return (
    <Section id="capabilities">
      <Wrap>
        <SectionHead
          eyebrow="What it does"
          title={
            <>
              Five questions it answers
              <br />
              about any <Serif>repository</Serif>
              <Stop />
            </>
          }
        >
          <p className="max-w-[58ch] text-[15px] leading-[1.68] text-ink-2">
            Each one is a capability that ships today. Pick a question; the panel shows what the
            engine returns and what it is allowed to say.
          </p>
        </SectionHead>

        <div className="grid grid-cols-1 overflow-hidden rounded-[4px] border border-rule-strong bg-paper-2 shadow-dossier lg:grid-cols-[330px_1fr]">
          <nav
            className="flex border-b border-rule bg-paper-3 lg:flex-col lg:border-b-0 lg:border-r"
            role="tablist"
            aria-label="Capabilities"
          >
            {PANELS.map((p) => {
              const on = active === p.id
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(p.id)}
                  className={[
                    'relative grid min-w-[190px] flex-none grid-cols-[34px_1fr_16px] items-center gap-x-3 border-rule px-4 py-[17px] text-left transition-colors lg:w-full lg:min-w-0 lg:border-b lg:last:border-b-0',
                    'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:bg-emerald after:transition-transform lg:after:inset-x-auto lg:after:-left-px lg:after:bottom-0 lg:after:top-0 lg:after:h-auto lg:after:w-0.5 lg:after:origin-center lg:after:scale-y-0 lg:after:scale-x-100',
                    on ? 'bg-paper-2 after:scale-x-100 lg:after:scale-y-100' : 'hover:bg-white/50 after:scale-x-0 lg:after:scale-y-0',
                  ].join(' ')}
                >
                  <span className={`font-mono text-[10px] tracking-[0.1em] ${on ? 'text-emerald' : 'text-ink-3'}`}>
                    {p.n}
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <span className={`text-[14px] font-semibold tracking-[-0.018em] ${on ? 'text-ink' : 'text-ink-2'}`}>
                      {p.label}
                    </span>
                    <span className="truncate font-mono text-[9.5px] text-ink-3 max-md:hidden">{p.q}</span>
                  </span>
                  <span
                    className={`font-mono text-xs text-emerald transition-[opacity,transform] ${on ? 'translate-x-0 opacity-55' : '-translate-x-1 opacity-0'}`}
                  >
                    →
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="relative min-h-[412px]">
            {active === 'dependency' && <PanelDependency />}
            {active === 'impact' && <PanelImpact />}
            {active === 'flow' && <PanelFlow />}
            {active === 'architecture' && <PanelArchitecture />}
            {active === 'assistant' && <PanelAssistant />}
          </div>
        </div>
      </Wrap>
    </Section>
  )
}

/** Shared panel frame: head, then a two-column body of prose and product output. */
function PanelShell({
  n,
  title,
  sub,
  chips,
  copy,
  facts,
  view,
  wide = false,
}: {
  n: string
  title: string
  sub: string
  chips: { label: string; tone?: 'ink' | 'mint' | 'sig' }[]
  copy: React.ReactNode
  facts: [string, string][]
  view: React.ReactNode
  wide?: boolean
}) {
  return (
    <article className="animate-dpanel-in">
      <header className="flex flex-col gap-3.5 border-b border-rule px-[22px] py-5 md:flex-row md:items-start md:justify-between md:gap-[22px]">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex-none pt-[3px] font-mono text-[10px] tracking-[0.1em] text-emerald">{n}</span>
          <div>
            <h3 className="text-[19px] font-semibold leading-tight tracking-[-0.028em] text-ink">{title}</h3>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-ink-3">{sub}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-start gap-[7px] md:justify-end">
          {chips.map((c) => (
            <Chip key={c.label} tone={c.tone}>
              {c.label}
            </Chip>
          ))}
        </div>
      </header>

      <div className={wide ? 'grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr]' : 'grid grid-cols-1 lg:grid-cols-2'}>
        <div className="border-b border-rule px-[22px] py-[22px] lg:border-b-0 lg:border-r">
          {copy}
          <div className="mt-5 border-t border-rule pt-3">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-[5px]">
                <span className="flex-none font-mono text-[8.5px] uppercase tracking-[0.13em] text-ink-3">{k}</span>
                <span className="text-right font-mono text-[10.5px] text-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex min-h-[340px] flex-col overflow-hidden bg-plate">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.028)_1px,transparent_1px)] bg-[length:30px_30px] opacity-50"
            aria-hidden="true"
          />
          <div className="relative flex flex-1 flex-col">{view}</div>
        </div>
      </div>
    </article>
  )
}

function PanelCopy({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 text-[13.5px] leading-[1.68] text-ink-2">{children}</div>
}

function PanelDependency() {
  return (
    <PanelShell
      n="01"
      title="A verified path between two files"
      sub="Traverses the resolved graph and returns the shortest chain, hop by hop."
      chips={[{ label: 'HIGH CONFIDENCE', tone: 'mint' }, { label: 'PATH_FIND' }]}
      copy={
        <PanelCopy>
          <p>
            Ask whether one file reaches another. Archon walks the graph in the direction it was
            asked, and returns the chain it found with the hop count attached. If the edge only
            exists one way, it tells you which.
          </p>
          <p>
            When a filename matches more than one indexed file, the resolver stops and returns{' '}
            <b className="font-semibold text-ink">AMBIGUOUS</b> with every candidate listed. It will
            not choose for you.
          </p>
        </PanelCopy>
      }
      facts={[
        ['Query shapes', 'direct · outbound · inbound · path · count'],
        ['Returns', 'hops + full path'],
        ['If unresolved', 'NOT_FOUND — no guess'],
      ]}
      view={
        <pre className="flex-1 overflow-x-auto whitespace-pre p-[18px] font-mono text-[11px] leading-[1.78] text-[#c9ced6]">
          <span className="text-[#5c626d]">// question</span>
          {'\n'}Does routes/auth.routes.ts reach
          {'\n'}prisma/schema.prisma?
          {'\n\n'}
          <span className="text-[#5c626d]">// traversal</span>
          {'\n'}
          <span className="text-[#c3a6ff]">step</span> 1  routes/auth.routes.ts
          {'\n'}
          {'       '}
          <span className="text-[#7fd1f0]">→</span> controllers/auth.controller.ts
          {'\n'}
          <span className="text-[#c3a6ff]">step</span> 2  controllers/auth.controller.ts
          {'\n'}
          {'       '}
          <span className="text-[#7fd1f0]">→</span> services/auth.service.ts
          {'\n'}
          <span className="text-[#c3a6ff]">step</span> 3  services/auth.service.ts
          {'\n'}
          {'       '}
          <span className="text-[#7fd1f0]">→</span> config/database.ts
          {'\n'}
          <span className="text-[#c3a6ff]">step</span> 4  config/database.ts
          {'\n'}
          {'       '}
          <span className="text-[#7fd1f0]">→</span> prisma/schema.prisma
          {'\n\n'}
          <span className="-mx-[18px] block bg-mint/10 px-[18px] text-[#9df5d4]">
            result   REACHABLE · 4 hops · HIGH
          </span>
        </pre>
      }
    />
  )
}

function PanelImpact() {
  const rows = [
    ['store-harness.ts', 'DIRECT', '1'],
    ['kanban/index.ts', 'DIRECT', '1'],
    ['store/types.ts', 'DIRECT', '1'],
    ['routes/auth.routes.ts', 'ROUTE', '3'],
    ['services/auth.service.ts', 'SERVICE', '4'],
  ]
  return (
    <PanelShell
      n="02"
      title="The blast radius, before you touch the file"
      sub="Reverse traversal to every dependent, scored by a published formula."
      chips={[{ label: 'HIGH RISK', tone: 'sig' }, { label: 'REVERSE GRAPH' }]}
      copy={
        <PanelCopy>
          <p>
            Select any file and Archon collects every file that reaches it, direct or indirect,
            recording the shortest hop distance to each. In-degree is how many import it directly;
            depth is the longest path in that cascade.
          </p>
          <p>
            The score is arithmetic, not opinion:{' '}
            <b className="font-semibold text-ink">0.6 × in-degree + 0.4 × depth</b>. Below 2.0 is
            low risk, below 5.0 is medium, anything above is high.
          </p>
        </PanelCopy>
      }
      facts={[
        ['Score', '0.6 × in-degree + 0.4 × depth'],
        ['Bands', 'LOW < 2.0 · MEDIUM < 5.0 · HIGH'],
        ['Categories', 'routes · services · controllers · components'],
      ]}
      view={
        <>
          <div className="grid grid-cols-4 border-b border-[#2b2e36]">
            {[
              { k: 'In-degree', v: '26' },
              { k: 'Depth', v: '5' },
              { k: 'Affected', v: '59', sig: true },
              { k: 'Score', v: '17.6' },
            ].map((m, i) => (
              <div key={m.k} className={`px-3.5 py-3 ${i < 3 ? 'border-r border-[#23262d]' : ''}`}>
                <span className="mb-1.5 block font-mono text-mono-micro uppercase text-[#686d78]">{m.k}</span>
                <span className={`text-[21px] font-semibold leading-none tracking-[-0.025em] ${m.sig ? 'text-[#ff8a76]' : 'text-[#e9ecf1]'}`}>
                  {m.v}
                </span>
              </div>
            ))}
          </div>
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr>
                {['Dependent file', 'Kind', 'Hops'].map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-[#23262d] px-3.5 py-2.5 text-[7.5px] font-normal uppercase tracking-[0.15em] text-[#686d78] ${i === 0 ? 'text-left' : i === 2 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([f, k, h]) => (
                <tr key={f}>
                  <td className="border-b border-[#1f2228] px-3.5 py-[7px] text-[#e0e4ea]">{f}</td>
                  <td className="border-b border-[#1f2228] px-3.5 py-[7px] text-[8.5px] tracking-[0.1em] text-[#7fd1f0]">{k}</td>
                  <td className="border-b border-[#1f2228] px-3.5 py-[7px] text-right text-mint">{h}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto border-t border-[#23262d] px-3.5 py-2.5 font-mono text-[8.5px] tracking-[0.13em] text-[#686d78]">
            SHOWING 5 OF 59 · RANKED BY HOPS
          </div>
        </>
      }
    />
  )
}

function PanelFlow() {
  const steps = [
    { ty: 'ROUTE', nm: 'routes/auth.routes.ts', ep: 'POST /scan-url' },
    { ty: 'CONTROLLER', nm: 'controllers/auth.controller.ts' },
    { ty: 'SERVICE', nm: 'services/auth.service.ts' },
    { ty: 'MODEL', nm: 'prisma/schema.prisma' },
  ]
  return (
    <PanelShell
      n="03"
      title="One request, from route to database"
      sub="Reconstructs the chain from conventions the parser recognises, then verifies it."
      chips={[{ label: '4 HOPS RESOLVED', tone: 'mint' }, { label: 'TRACE' }]}
      copy={
        <PanelCopy>
          <p>
            Archon recognises the conventions that make a web service legible: route files,
            controllers, services, models. It reconstructs the chain they form and then checks each
            link against the import graph.
          </p>
          <p>
            A backend with no routes is not a failure. The resolver falls back to
            controller-to-service, and reports the architecture as modular rather than inventing a
            chain it could not verify.
          </p>
        </PanelCopy>
      }
      facts={[
        ['Chain', 'route → controller → service'],
        ['Fallback', 'controller → service'],
        ['When neither', 'modular architecture'],
      ]}
      view={
        <ol className="flex flex-1 flex-col px-5 py-[18px]">
          {steps.map((s, i) => (
            <li key={s.nm} className="relative grid grid-cols-1 items-center gap-1 py-3.5 pl-[26px] md:grid-cols-[88px_1fr] md:gap-x-3.5 md:gap-y-0">
              <span
                className={[
                  'absolute left-1.5 w-px bg-[#2b2e36]',
                  i === 0 ? 'top-1/2 bottom-0' : i === steps.length - 1 ? 'top-0 bottom-1/2' : 'inset-y-0',
                  'before:absolute before:-left-1 before:top-1/2 before:mt-[-4.5px] before:h-[9px] before:w-[9px] before:rounded-full before:bg-mint before:shadow-[0_0_0_3px_rgba(37,208,160,.14)] before:content-[""]',
                ].join(' ')}
              />
              <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-[#686d78]">{s.ty}</span>
              <span className="font-mono text-[11.5px] text-[#e6e9ee]">{s.nm}</span>
              {s.ep && (
                <span className="font-mono text-[9.5px] text-[#ff8a76] md:col-start-2">{s.ep}</span>
              )}
            </li>
          ))}
        </ol>
      }
    />
  )
}

function PanelArchitecture() {
  return (
    <PanelShell
      wide
      n="04"
      title="A map of the system, drawn from the system"
      sub="The dependency graph laid out spatially, not a prettified folder tree."
      chips={[{ label: '400 NODES', tone: 'mint' }, { label: '1,180 EDGES' }]}
      copy={
        <PanelCopy>
          <p>
            Position is force-directed from the actual adjacency, so clusters form where modules
            genuinely couple rather than where the folders say they should. The highest in-degree
            files surface as what they are: the load-bearing walls.
          </p>
        </PanelCopy>
      }
      facts={[
        ['Input', 'resolved import graph'],
        ['Layout', 'force-directed'],
        ['Signal', 'in-degree = criticality'],
      ]}
      view={
        <div className="grid flex-1 place-items-center p-[18px]">
          <svg viewBox="0 0 560 300" className="h-auto w-full" aria-label="Module dependency graph">
            <g stroke="rgba(37,208,160,.34)" fill="none" strokeWidth="1">
              <path d="M280 148 400 84M280 148 452 168M280 148 396 236M280 148 168 84M280 148 118 172M280 148 182 242M400 84 500 44M452 168 528 122M396 236 486 276M168 84 78 46M118 172 44 136M182 242 96 278" />
            </g>
            <g stroke="rgba(255,255,255,.13)" fill="none" strokeWidth="1">
              <path d="M400 84 168 84M452 168 396 236M118 172 182 242M168 84 44 136" />
            </g>
            <circle cx="280" cy="148" r="22" fill="#25d0a0" opacity=".16" />
            <circle cx="280" cy="148" r="8.5" fill="#25d0a0" />
            <text x="280" y="184" textAnchor="middle" fill="#9aa0ab" className="font-mono text-[9px]">
              types/index.ts
            </text>
            <g>
              <circle cx="400" cy="84" r="6" fill="#25d0a0" />
              <circle cx="452" cy="168" r="6" fill="#25d0a0" />
              <circle cx="396" cy="236" r="5.5" fill="#25d0a0" />
              <circle cx="168" cy="84" r="6" fill="#e2462f" />
              <circle cx="118" cy="172" r="5.5" fill="#25d0a0" />
              <circle cx="182" cy="242" r="5.5" fill="#25d0a0" />
            </g>
            <g fill="#b9c0cb">
              <circle cx="500" cy="44" r="3.5" />
              <circle cx="528" cy="122" r="3.5" />
              <circle cx="486" cy="276" r="3.5" />
              <circle cx="78" cy="46" r="3.5" />
              <circle cx="44" cy="136" r="3.5" />
              <circle cx="96" cy="278" r="3.5" />
            </g>
            <text x="424" y="72" fill="#686d78" className="font-mono text-[8px]">
              store/
            </text>
            <text x="132" y="72" fill="#ff8a76" className="font-mono text-[8px]">
              route layer
            </text>
          </svg>
        </div>
      }
    />
  )
}

function PanelAssistant() {
  return (
    <PanelShell
      n="05"
      title="Ask in plain language, get a citation"
      sub="Planned before answered. The files it read come back with the reply."
      chips={[{ label: 'GROUNDED', tone: 'mint' }, { label: 'HIGH CONFIDENCE' }]}
      copy={
        <PanelCopy>
          <p>
            Questions are planned before they are answered. The intent is classified first —
            dependency, flow, database or architecture — and only then is context retrieved.
          </p>
          <p>
            The reply lists the files it read, the chunks it used and the steps it ran. A wrong
            answer can therefore be traced to a wrong retrieval rather than to an invented fact.
          </p>
        </PanelCopy>
      }
      facts={[
        ['Intents', 'dependency · flow · database · architecture'],
        ['Context', 'symbol-aligned chunks'],
        ['Trace', 'executed steps shown'],
      ]}
      view={
        <div className="flex flex-1 flex-col gap-3.5 px-5 py-[18px]">
          <div className="border-l-2 border-[#34383f] pl-3.5 text-[12.5px] leading-[1.62] text-[#dfe3e9]">
            <span className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.15em] text-[#686d78]">
              You
            </span>
            Where is the request authenticated before it reaches the repo controller?
          </div>
          <div className="border-l-2 border-mint pl-3.5 text-[12.5px] leading-[1.62] text-[#a8adb6]">
            <span className="mb-1.5 block font-mono text-[8.5px] uppercase tracking-[0.15em] text-mint">
              Archon
            </span>
            Authentication runs as Express middleware on the route, not inside the controller. The
            route is wrapped by <code className="font-mono text-[11.5px] text-[#c3e88d]">requireAuth</code>{' '}
            before <code className="font-mono text-[11.5px] text-[#c3e88d]">repoController</code> is
            ever invoked.
          </div>
          <div className="overflow-hidden rounded-[3px] border border-[#2b2e36]">
            {[
              ['middleware/requireAuth.ts', 'line 1'],
              ['routes/repo.routes.ts', 'line 47'],
            ].map(([f, l], i, arr) => (
              <div
                key={f}
                className={`flex items-center justify-between gap-3 px-3 py-2 font-mono text-[10.5px] text-[#e6e9ee] ${i < arr.length - 1 ? 'border-b border-[#23262d]' : ''}`}
              >
                <span>{f}</span>
                <span className="text-[9.5px] text-[#686d78]">{l}</span>
              </div>
            ))}
          </div>
          <div className="font-mono text-[9px] tracking-[0.1em] text-[#686d78]">
            READ 3 files · 2 chunks · 412 tokens
          </div>
        </div>
      }
    />
  )
}
