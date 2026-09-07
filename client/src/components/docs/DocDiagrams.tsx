import React from 'react';

/**
 * Clean, production-grade SVG/CSS diagrams for Archon Documentation.
 * High-level, developer-friendly, and privacy-respecting.
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
    <div style={{
      margin: '24px 0',
      padding: '24px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--accent, #b026ff)',
        marginBottom: '16px',
      }}>
        Codebase Intelligence Pipeline
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        position: 'relative',
      }}>
        {steps.map((s) => (
          <div key={s.num} style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '6px',
            padding: '12px 14px',
            position: 'relative',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#71717a',
              marginBottom: '4px',
              fontFamily: 'monospace',
            }}>
              STAGE {s.num}
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#f4f4f5',
              marginBottom: '4px',
            }}>
              {s.title}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#a1a1aa',
              lineHeight: 1.4,
            }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ASTDecompositionDiagram() {
  return (
    <div style={{
      margin: '24px 0',
      padding: '20px 24px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#b026ff', marginBottom: '12px' }}>
        Syntax Tree (AST) Symbol Hierarchy
      </div>
      <div style={{ fontSize: '12px', color: '#e4e4e7', lineHeight: 1.8 }}>
        <div style={{ color: '#60a5fa' }}>SourceFile (orderService.ts)</div>
        <div style={{ paddingLeft: '16px', color: '#a1a1aa' }}>├── ImportDeclaration: <span style={{ color: '#4ade80' }}>'../models/order'</span></div>
        <div style={{ paddingLeft: '16px', color: '#a1a1aa' }}>├── ImportDeclaration: <span style={{ color: '#4ade80' }}>'../services/payment'</span></div>
        <div style={{ paddingLeft: '16px', color: '#f43f5e' }}>└── ClassDeclaration: <span style={{ color: '#f4f4f5' }}>OrderProcessor</span></div>
        <div style={{ paddingLeft: '32px', color: '#c084fc' }}>├── MethodDeclaration: <span style={{ color: '#facc15' }}>createOrder</span></div>
        <div style={{ paddingLeft: '48px', color: '#71717a' }}>├── Parameter: (items, customerId)</div>
        <div style={{ paddingLeft: '48px', color: '#71717a' }}>└── CallExpression: paymentService.charge</div>
        <div style={{ paddingLeft: '32px', color: '#c084fc' }}>└── MethodDeclaration: <span style={{ color: '#facc15' }}>validateDiscount</span></div>
        <div style={{ paddingLeft: '48px', color: '#71717a' }}>└── CallExpression: calculatePercentage</div>
      </div>
    </div>
  );
}

export function TarjanSCCDiagram() {
  return (
    <div style={{
      margin: '24px 0',
      padding: '20px 24px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#facc15', marginBottom: '12px' }}>
        Circular Dependency Detection
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '16px 0',
        flexWrap: 'wrap',
      }}>
        <div style={{
          padding: '8px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#f87171',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          orderService.ts
        </div>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>➔ (imports)</span>
        <div style={{
          padding: '8px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#f87171',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          invoiceService.ts
        </div>
        <span style={{ color: '#ef4444', fontWeight: 700 }}>➔ (imports back)</span>
        <div style={{
          padding: '8px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#f87171',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontWeight: 600,
        }}>
          orderService.ts
        </div>
      </div>
      <div style={{ fontSize: '12px', color: '#a1a1aa', textAlign: 'center' }}>
        Circular dependency component detected and highlighted in your codebase workspace.
      </div>
    </div>
  );
}

export function RiskScoreFormulaDiagram() {
  return (
    <div style={{
      margin: '24px 0',
      padding: '20px 24px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#60a5fa', marginBottom: '8px' }}>
        Change Impact & Risk Formula
      </div>
      <div style={{
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f4f4f5',
        padding: '12px 16px',
        background: 'rgba(0, 0, 0, 0.4)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        marginBottom: '12px',
        display: 'inline-block',
      }}>
        Risk Score = 0.6 &times; InDegree + 0.4 &times; BlastRadiusDepth
      </div>
      <div style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.6 }}>
        Combines direct module dependency count with maximum downstream dependency chain length to quantify regression risk.
      </div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
          LOW RISK (&lt; 2.0)
        </span>
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
          MEDIUM RISK (2.0 – 5.0)
        </span>
        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
          HIGH RISK (&ge; 5.0)
        </span>
      </div>
    </div>
  );
}

export function RAGArchitectureDiagram() {
  return (
    <div style={{
      margin: '24px 0',
      padding: '20px 24px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#c084fc', marginBottom: '14px' }}>
        Context-Grounded Code Search & Q&A
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
      }}>
        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>1. Developer Question</div>
          <div style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 500 }}>&ldquo;Where is user session created?&rdquo;</div>
        </div>

        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>2. Semantic Search</div>
          <div style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 500 }}>Vector similarity match across codebase</div>
        </div>

        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>3. Evidence Assembly</div>
          <div style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 500 }}>Relevant code snippets & dependency metrics</div>
        </div>

        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '4px' }}>4. Grounded Answer</div>
          <div style={{ fontSize: '12px', color: '#f4f4f5', fontWeight: 500 }}>Precise response with clickable file links</div>
        </div>
      </div>
    </div>
  );
}
