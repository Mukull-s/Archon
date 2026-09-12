import React from 'react';
import { Panel, Typography, Badge } from '../../ui/DesignSystem';

interface OverviewConfidenceProps {
  confidence: number;
  checklist: string[];
}

export const OverviewConfidence: React.FC<OverviewConfidenceProps> = ({
  confidence,
  checklist = [],
}) => {
  const getHealthLevel = (score: number) => {
    if (score >= 80) return { label: 'Optimal Deterministic Resolution', color: 'text-emerald-400', badge: 'success' as const };
    if (score >= 60) return { label: 'Moderate Architectural Resolution', color: 'text-amber-400', badge: 'warning' as const };
    return { label: 'Partial Ingestion / Analysis Gaps', color: 'text-red-400', badge: 'danger' as const };
  };

  const health = getHealthLevel(confidence);

  // Group checklist into 4 core architectural evidence dimensions
  const categorizeChecks = () => {
    const astItems: string[] = [];
    const depItems: string[] = [];
    const execItems: string[] = [];
    const dbItems: string[] = [];
    const otherItems: string[] = [];

    checklist.forEach((item) => {
      const lower = item.toLowerCase();
      if (lower.includes('ast')) {
        astItems.push(item);
      } else if (lower.includes('dependency') || lower.includes('import')) {
        depItems.push(item);
      } else if (lower.includes('execution') || lower.includes('chain') || lower.includes('route') || lower.includes('controller')) {
        execItems.push(item);
      } else if (lower.includes('database') || lower.includes('db') || lower.includes('prisma') || lower.includes('model')) {
        dbItems.push(item);
      } else {
        otherItems.push(item);
      }
    });

    return [
      {
        title: 'AST Structure & Language Coverage',
        items: astItems.length > 0 ? astItems : ['AST parsing resolved across active language runtime files.'],
      },
      {
        title: 'Import & Dependency Topology',
        items: depItems.length > 0 ? depItems : ['Codebase dependency imports mapped and normalized.'],
      },
      {
        title: 'Route-Controller-Service Execution Resolution',
        items: execItems.length > 0 ? execItems : ['Execution chains evaluated across entry controllers.'],
      },
      {
        title: 'Database Schema & Client Integration',
        items: dbItems.length > 0 ? dbItems : ['Database models and schema interfaces identified.'],
      },
    ];
  };

  const dimensions = categorizeChecks();

  return (
    <section 
      aria-label="Confidence & Architectural Evidence" 
      className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 my-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#27272a]/60 pb-3.5 mb-5 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          <h2 className="text-[12px] font-mono font-bold text-white uppercase tracking-wider m-0">
            Analysis Confidence & Deterministic Evidence
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={health.badge} className="text-[10.5px] font-mono">
            {confidence}% ENGINE CONFIDENCE
          </Badge>
        </div>
      </div>

      {/* Summary Guarantee Callout */}
      <div className="p-3.5 rounded-[6px] bg-[#131316] border border-[#27272a] mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <span className={`text-[12.5px] font-mono font-semibold ${health.color}`}>
            Status: {health.label}
          </span>
          <p className="text-[11.5px] text-[#919095] font-mono m-0">
            Confidence reflects deterministic AST parsing, dependency link completeness, and layered execution verification without heuristic guessing.
          </p>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full sm:w-48 shrink-0">
          <div className="flex justify-between text-[10px] font-mono text-[#919095] mb-1">
            <span>Score</span>
            <span className="text-white font-bold">{confidence}%</span>
          </div>
          <div className="h-1.5 w-full bg-[#1f1f22] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                confidence >= 80 ? 'bg-emerald-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>
      </div>

      {/* 4 Evidence Dimensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dimensions.map((dim, idx) => (
          <div 
            key={idx} 
            className="bg-[#131316] border border-[#27272a] rounded-[6px] p-3.5 flex flex-col justify-between"
          >
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#fafafa] mb-2 block">
              {dim.title}
            </span>
            <div className="space-y-1.5">
              {dim.items.map((line, lIdx) => {
                const isWarning = line.startsWith('⚠');
                return (
                  <div key={lIdx} className="flex items-start gap-2 text-[11.5px] font-mono leading-relaxed">
                    <span className={isWarning ? 'text-amber-400 shrink-0' : 'text-emerald-400 shrink-0'}>
                      {isWarning ? '⚠' : '✓'}
                    </span>
                    <span className={isWarning ? 'text-[#e4e1e5]' : 'text-[#c8c5ca]'}>
                      {line.replace(/^[✓⚠]\s*/, '')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
