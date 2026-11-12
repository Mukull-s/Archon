import React from 'react';

/**
 * Diagrams for the Archon documentation.
 *
 * Each one is a `mini` panel — the system's small container — so a diagram reads
 * as one more instrument on the page rather than an illustration pasted in from
 * somewhere else. Colour is load-bearing: emerald for what the pipeline proves,
 * amber for what needs attention, signal red for a cycle or a high-risk band.
 * Nothing glows, nothing is violet.
 */

export function IndexingPipelineDiagram() {
  const steps = [
    { num: '01', title: 'Code Ingestion', desc: 'Connect GitHub repository or upload local project' },
    { num: '02', title: 'Sanitization', desc: 'Prune dependencies, build artifacts, lockfiles & binaries' },
    { num: '03', title: 'AST Parsing', desc: 'Syntax tree decomposition & symbol boundary extraction' },
    { num: '04', title: 'Dependency Graph', desc: 'Path resolution, module linking & circular loop detection' },
    { num: '05', title: 'Semantic Chunking', desc: 'Structure-preserving code blocks with file context' },
    { num: '06', title: 'Code Vectorization', desc: 'Specialized code embedding representation' },
    { num: '07', title: 'Indexed Storage', desc: 'High-speed vector indexing for instant workspace queries' },
  ];

  return (
    <div className="mini my-6">
      <div className="mini__head">
        <span className="figcap">
          <b>Codebase Intelligence Pipeline</b>
        </span>
      </div>
      <div className="mini__body grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 p-4">
        {steps.map((s) => (
          <div key={s.num} className="rounded-[3px] border border-rule bg-paper-2 px-3.5 py-3">
            <div className="mb-1 font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-3">
              STAGE {s.num}
            </div>
            <div className="mb-1 text-[13px] font-semibold text-ink">{s.title}</div>
            <div className="text-[11px] leading-[1.4] text-ink-2">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ASTDecompositionDiagram() {
  return (
    <div className="mini my-6">
      <div className="mini__head">
        <span className="figcap">
          <b>Syntax Tree (AST) Symbol Hierarchy</b>
        </span>
      </div>
      <div className="mini__body p-4 font-mono text-[12px] leading-[1.8] text-ink">
        <div className="text-emerald">SourceFile (orderService.ts)</div>
        <div className="pl-4 text-ink-2">
          ├── ImportDeclaration: <span className="text-mint">'../models/order'</span>
        </div>
        <div className="pl-4 text-ink-2">
          ├── ImportDeclaration: <span className="text-mint">'../services/payment'</span>
        </div>
        <div className="pl-4 text-sig">
          └── ClassDeclaration: <span className="text-ink">OrderProcessor</span>
        </div>
        <div className="pl-8 text-emerald">
          ├── MethodDeclaration: <span className="text-amber">createOrder</span>
        </div>
        <div className="pl-12 text-ink-3">├── Parameter: (items, customerId)</div>
        <div className="pl-12 text-ink-3">└── CallExpression: paymentService.charge</div>
        <div className="pl-8 text-emerald">
          └── MethodDeclaration: <span className="text-amber">validateDiscount</span>
        </div>
        <div className="pl-12 text-ink-3">└── CallExpression: calculatePercentage</div>
      </div>
    </div>
  );
}

export function TarjanSCCDiagram() {
  return (
    <div className="mini my-6">
      <div className="mini__head">
        <span className="figcap">
          <b>Circular Dependency Detection</b>
        </span>
      </div>
      <div className="mini__body p-4">
        <div className="flex flex-wrap items-center justify-center gap-4 py-4">
          <span className="rounded-[3px] border border-sig/30 bg-sig/[0.08] px-4 py-2 font-mono text-[12px] font-semibold text-sig">
            orderService.ts
          </span>
          <span className="font-semibold text-sig">➔ (imports)</span>
          <span className="rounded-[3px] border border-sig/30 bg-sig/[0.08] px-4 py-2 font-mono text-[12px] font-semibold text-sig">
            invoiceService.ts
          </span>
          <span className="font-semibold text-sig">➔ (imports back)</span>
          <span className="rounded-[3px] border border-sig/30 bg-sig/[0.08] px-4 py-2 font-mono text-[12px] font-semibold text-sig">
            orderService.ts
          </span>
        </div>
        <div className="text-center text-[12px] text-ink-2">
          Circular dependency component detected and highlighted in your codebase workspace.
        </div>
      </div>
    </div>
  );
}

export function RiskScoreFormulaDiagram() {
  return (
    <div className="mini my-6">
      <div className="mini__head">
        <span className="figcap">
          <b>Change Impact &amp; Risk Formula</b>
        </span>
      </div>
      <div className="mini__body p-4">
        <div className="mb-3 inline-block rounded-[3px] border border-rule bg-paper-3 px-4 py-3 font-mono text-[15px] text-ink">
          Risk Score = 0.6 &times; InDegree + 0.4 &times; BlastRadiusDepth
        </div>
        <div className="text-[12px] leading-[1.6] text-ink-2">
          Combines direct module dependency count with maximum downstream dependency chain length to quantify regression risk.
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <span className="rounded-[3px] border border-emerald/30 bg-emerald/[0.08] px-2 py-0.5 font-mono text-[11px] text-emerald">
            LOW RISK (&lt; 2.0)
          </span>
          <span className="rounded-[3px] border border-amber/30 bg-amber/[0.08] px-2 py-0.5 font-mono text-[11px] text-amber">
            MEDIUM RISK (2.0 – 5.0)
          </span>
          <span className="rounded-[3px] border border-sig/30 bg-sig/[0.08] px-2 py-0.5 font-mono text-[11px] text-sig">
            HIGH RISK (&ge; 5.0)
          </span>
        </div>
      </div>
    </div>
  );
}

export function RAGArchitectureDiagram() {
  const steps = [
    { n: '1. Developer Question', v: '\u201CWhere is user session created?\u201D' },
    { n: '2. Semantic Search', v: 'Vector similarity match across codebase' },
    { n: '3. Evidence Assembly', v: 'Relevant code snippets & dependency metrics' },
    { n: '4. Grounded Answer', v: 'Precise response with clickable file links' },
  ];

  return (
    <div className="mini my-6">
      <div className="mini__head">
        <span className="figcap">
          <b>Context-Grounded Code Search &amp; Q&amp;A</b>
        </span>
      </div>
      <div className="mini__body grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 p-4">
        {steps.map((s) => (
          <div key={s.n} className="rounded-[3px] border border-rule bg-paper-2 p-3">
            <div className="mb-1 font-mono text-[11px] text-ink-3">{s.n}</div>
            <div className="text-[12px] font-medium text-ink">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
