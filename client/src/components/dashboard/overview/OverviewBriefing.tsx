import React, { useState } from 'react';
import { Panel, Typography, Button, Badge } from '../../ui/DesignSystem';

interface AISummaryData {
  summary?: string;
  purpose?: string;
  targetUsers?: string[];
  keyFeatures?: string[];
  coreModules?: string[];
  techStack?: string[];
  complexity?: 'Low' | 'Medium' | 'High' | string;
}

interface OverviewBriefingProps {
  summaryData?: AISummaryData | null;
  indexingStatus?: string;
  summaryLoading?: boolean;
  showManualButton?: boolean;
  onGenerateSummary?: () => void;
  onExploreModule?: (moduleName: string) => void;
  onTriggerChat?: (prompt: string) => void;
}

export const OverviewBriefing: React.FC<OverviewBriefingProps> = ({
  summaryData,
  indexingStatus,
  summaryLoading = false,
  showManualButton = false,
  onGenerateSummary,
  onExploreModule,
  onTriggerChat,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summaryData) {
    if (showManualButton) {
      return (
        <section aria-label="Technical Briefing" className="my-6">
          <div className="p-5 border border-dashed border-[#27272a] bg-[#0e0e11]/60 rounded-[8px] text-center">
            <h2 className="text-[12px] font-mono font-bold text-[#919095] tracking-wider uppercase mb-1">
              Codebase Technical Briefing
            </h2>
            <p className="text-[12.5px] text-[#919095] max-w-md mx-auto mb-3 leading-relaxed">
              Generate a structured synthesis of the domain, purpose, modules, and tech stack derived from repository AST and entry points.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={onGenerateSummary}
              isLoading={summaryLoading}
              className="font-mono text-[11px]"
            >
              {summaryLoading ? 'Synthesizing...' : 'Generate Technical Briefing'}
            </Button>
          </div>
        </section>
      );
    }

    return (
      <section aria-label="Technical Briefing" className="my-6">
        <div className="p-4 border border-[#27272a]/60 bg-[#0e0e11]/40 rounded-[8px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-[11.5px] font-mono font-semibold text-[#e4e1e5] uppercase tracking-wider">
                Synthesizing Codebase Briefing...
              </h2>
              <p className="text-[11px] text-[#71717a] font-mono mt-0.5">
                Analyzing architecture entrypoints, routes, and package boundaries in background.
              </p>
            </div>
          </div>
          {onGenerateSummary && (
            <button
              onClick={onGenerateSummary}
              disabled={summaryLoading}
              className="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer shrink-0 disabled:opacity-50"
            >
              Force Generate
            </button>
          )}
        </div>
      </section>
    );
  }

  const {
    summary,
    purpose,
    targetUsers = [],
    keyFeatures = [],
    coreModules = [],
    techStack = [],
    complexity = 'Medium'
  } = summaryData;

  const getComplexityBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return <Badge variant="success" className="text-[10px]">COMPLEXITY: LOW</Badge>;
      case 'high':
        return <Badge variant="danger" className="text-[10px]">COMPLEXITY: HIGH</Badge>;
      default:
        return <Badge variant="warning" className="text-[10px]">COMPLEXITY: MEDIUM</Badge>;
    }
  };

  return (
    <section 
      aria-label="Codebase Technical Briefing" 
      className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 my-6 relative select-text"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 mb-4 border-b border-[#27272a]/60 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" aria-hidden="true" />
          <h2 className="text-[11px] font-mono font-bold text-[#fafafa] uppercase tracking-wider m-0">
            Technical Briefing
          </h2>
          <span className="text-[11px] font-mono text-[#919095]">
            · Architectural & Domain Synthesis
          </span>
        </div>
        <div className="flex items-center gap-2">
          {getComplexityBadge(complexity)}
          {onTriggerChat && (
            <button
              onClick={() => onTriggerChat(`Explain the architectural intent and design choices of ${summary || purpose || 'this codebase'}`)}
              className="text-[11px] font-mono text-[#919095] hover:text-[#a855f7] transition-colors flex items-center gap-1 cursor-pointer"
              title="Query AI Assistant about this architecture"
            >
              <span>Ask AI</span>
              <span>➔</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Column (Purpose & Summary narrative) */}
        <div className="md:col-span-7 space-y-3.5">
          {purpose && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1">
                Primary Purpose
              </span>
              <p className="text-[13px] leading-relaxed text-[#fafafa] font-body bg-[#131316] border border-[#27272a] p-3 rounded-[6px]">
                {purpose}
              </p>
            </div>
          )}

          {summary && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1">
                System Context
              </span>
              <p className="text-[12.5px] leading-relaxed text-[#c8c5ca] font-body">
                {summary}
              </p>
            </div>
          )}

          {targetUsers.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1.5">
                Target Consumers
              </span>
              <div className="flex flex-wrap gap-1.5">
                {targetUsers.map((user, idx) => (
                  <span
                    key={idx}
                    className="bg-[#18181b] border border-[#27272a] text-[#c8c5ca] text-[10.5px] font-mono px-2 py-0.5 rounded-[4px]"
                  >
                    {user}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Modules, Features, Stack) */}
        <div className="md:col-span-5 space-y-3.5 border-t md:border-t-0 md:border-l border-[#27272a]/60 pt-4 md:pt-0 md:pl-5">
          {coreModules.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1.5">
                Identified Core Modules
              </span>
              <div className="flex flex-wrap gap-1.5">
                {coreModules.map((module, idx) => (
                  <button
                    key={idx}
                    onClick={() => onExploreModule?.(module)}
                    className="bg-[#3b82f6]/10 border border-[#3b82f6]/25 hover:border-[#3b82f6]/60 text-[#93c5fd] hover:text-white text-[10.5px] font-mono px-2 py-0.5 rounded-[4px] transition-colors cursor-pointer text-left"
                    title={`Inspect module: ${module}`}
                  >
                    {module}
                  </button>
                ))}
              </div>
            </div>
          )}

          {keyFeatures.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1">
                Key Architectural Capabilities
              </span>
              <ul className="list-disc list-inside space-y-1 text-[12px] text-[#c8c5ca]">
                {keyFeatures.slice(0, isExpanded ? undefined : 3).map((feat, idx) => (
                  <li key={idx} className="truncate" title={feat}>
                    {feat}
                  </li>
                ))}
              </ul>
              {keyFeatures.length > 3 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[10px] font-mono text-[#3b82f6] hover:underline mt-1 cursor-pointer"
                >
                  {isExpanded ? 'Show less' : `+ ${keyFeatures.length - 3} more capabilities`}
                </button>
              )}
            </div>
          )}

          {techStack.length > 0 && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#919095] block mb-1.5">
                Technology Profile
              </span>
              <div className="flex flex-wrap gap-1.5">
                {techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="bg-[#18181b] border border-[#27272a] text-[#c8c5ca] text-[10.5px] font-mono px-2 py-0.5 rounded-[4px]"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
