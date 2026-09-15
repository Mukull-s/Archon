import React, { useState } from 'react';
import { Panel, Typography, Button, Badge } from '../../ui/DesignSystem';

export interface DriftViolation {
  filePath: string;
  targetPath: string;
  violation: string;
}

export interface CentralityHotspot {
  filePath: string;
  inDegree: number;
}

interface OverviewFindingsProps {
  architecturalDrift: DriftViolation[];
  circularDependencies: string[][];
  centralityHotspots: CentralityHotspot[];
  missingTests: string[];
  deadCode: string[];
  onNavigateToExplorer?: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onTriggerChat?: (prompt: string) => void;
}

export const OverviewFindings: React.FC<OverviewFindingsProps> = ({
  architecturalDrift = [],
  circularDependencies = [],
  centralityHotspots = [],
  missingTests = [],
  deadCode = [],
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToImpact,
  onTriggerChat,
}) => {
  const [showAllDrift, setShowAllDrift] = useState(false);
  const [showAllCycles, setShowAllCycles] = useState(false);
  const [showAllHotspots, setShowAllHotspots] = useState(false);
  const [expandedQualityTab, setExpandedQualityTab] = useState<'tests' | 'dead' | null>(null);

  const displayedDrift = showAllDrift ? architecturalDrift : architecturalDrift.slice(0, 4);
  const displayedCycles = showAllCycles ? circularDependencies : circularDependencies.slice(0, 3);
  const displayedHotspots = showAllHotspots ? centralityHotspots : centralityHotspots.slice(0, 5);

  const totalIssueCount = architecturalDrift.length + circularDependencies.length;

  return (
    <section 
      id="overview-findings" 
      aria-label="Architectural Health and Critical Findings" 
      className="space-y-6 my-8 scroll-mt-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#27272a] pb-3 gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${totalIssueCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} aria-hidden="true" />
          <h2 className="text-[14px] font-mono font-bold text-[#fafafa] uppercase tracking-wider m-0">
            Architectural Health & Critical Findings
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {totalIssueCount > 0 ? (
            <span className="text-[11px] font-mono text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded">
              {totalIssueCount} {totalIssueCount === 1 ? 'Condition Requiring Review' : 'Conditions Requiring Review'}
            </span>
          ) : (
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded">
              ✓ Clean Architecture State
            </span>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3A: ARCHITECTURAL DRIFT INSPECTOR                          */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-white">
              Layer Drift & Boundary Violations
            </span>
            <Badge 
              variant={architecturalDrift.length > 0 ? 'warning' : 'success'} 
              className="text-[10px] font-mono"
            >
              {architecturalDrift.length === 0 
                ? '0 VIOLATIONS' 
                : `${architecturalDrift.length} ${architecturalDrift.length === 1 ? 'VIOLATION' : 'VIOLATIONS'}`}
            </Badge>
          </div>
          <span className="text-[11px] font-mono text-[#919095] hidden sm:inline">
            Layer Rules: Route ➔ Controller ➔ Service ➔ Database
          </span>
        </div>

        {architecturalDrift.length === 0 ? (
          <div className="p-4 rounded-[6px] bg-[#131316] border border-[#27272a] flex items-center gap-3">
            <span className="text-emerald-400 font-mono text-[14px]">✓</span>
            <p className="text-[12.5px] font-mono text-[#c8c5ca] m-0">
              No architectural layer drift detected. Clean unidirectional boundaries preserved across controllers, services, and models.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayedDrift.map((finding, idx) => {
              const sourceBase = finding.filePath.split('/').pop() || finding.filePath;
              const targetBase = finding.targetPath.split('/').pop() || finding.targetPath;

              return (
                <div
                  key={idx}
                  className="bg-[#131316] border border-[#27272a] hover:border-[#39393c] rounded-[6px] p-3 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    {/* Source -> Target Chain */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-[12px] font-mono">
                        <span 
                          className="text-[#fafafa] font-semibold hover:text-[#3b82f6] cursor-pointer truncate max-w-[240px]"
                          title={finding.filePath}
                          onClick={() => onNavigateToExplorer?.(finding.filePath)}
                        >
                          {sourceBase}
                        </span>
                        <span className="text-amber-400 font-bold shrink-0">➔</span>
                        <span 
                          className="text-[#c8c5ca] hover:text-[#3b82f6] cursor-pointer truncate max-w-[240px]"
                          title={finding.targetPath}
                          onClick={() => onNavigateToExplorer?.(finding.targetPath)}
                        >
                          {targetBase}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[#fca5a5] font-mono m-0 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" aria-hidden="true" />
                        {finding.violation}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start lg:self-center">
                      {onNavigateToExplorer && (
                        <button
                          type="button"
                          onClick={() => onNavigateToExplorer(finding.filePath)}
                          className="px-2 py-1 rounded bg-[#1f1f22] hover:bg-[#27272a] border border-[#27272a] text-[10.5px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer"
                          title={`Open ${finding.filePath} in Explorer`}
                        >
                          Open File
                        </button>
                      )}
                      {onNavigateToGraph && (
                        <button
                          type="button"
                          onClick={() => onNavigateToGraph(finding.filePath)}
                          className="px-2 py-1 rounded bg-[#1f1f22] hover:bg-[#27272a] border border-[#27272a] text-[10.5px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer"
                          title={`View ${finding.filePath} in Architecture Graph`}
                        >
                          View Graph
                        </button>
                      )}
                      {onNavigateToImpact && (
                        <button
                          type="button"
                          onClick={() => onNavigateToImpact(finding.filePath)}
                          className="px-2 py-1 rounded bg-[#1f1f22] hover:bg-[#27272a] border border-[#27272a] text-[10.5px] font-mono text-[#c8c5ca] hover:text-white transition-colors cursor-pointer"
                          title={`Analyze blast radius of ${finding.filePath}`}
                        >
                          Check Impact
                        </button>
                      )}
                      {onTriggerChat && (
                        <button
                          type="button"
                          onClick={() => onTriggerChat(`Explain how to refactor ${finding.filePath} to fix this layer violation: ${finding.violation}`)}
                          className="px-2 py-1 rounded bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/30 text-[10.5px] font-mono text-[#ddb7ff] transition-colors cursor-pointer"
                          title="Ask AI how to refactor this violation"
                        >
                          Explain Fix
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {architecturalDrift.length > 4 && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllDrift(!showAllDrift)}
                  className="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer"
                >
                  {showAllDrift 
                    ? 'Collapse drift list' 
                    : `Show all ${architecturalDrift.length} layer drift violations`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3B & 3C: CIRCULAR DEPENDENCIES & CENTRALITY HOTSPOTS       */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sub-Section: Circular Dependencies */}
        <div className="lg:col-span-6 bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-white">
                Circular Dependency Loops
              </span>
              <Badge 
                variant={circularDependencies.length > 0 ? 'warning' : 'success'} 
                className="text-[10px] font-mono"
              >
                {circularDependencies.length === 0 
                  ? '0 CYCLES' 
                  : `${circularDependencies.length} ${circularDependencies.length === 1 ? 'CYCLE' : 'CYCLES'}`}
              </Badge>
            </div>

            {circularDependencies.length === 0 ? (
              <div className="p-4 rounded-[6px] bg-[#131316] border border-[#27272a] flex items-center gap-3">
                <span className="text-emerald-400 font-mono text-[14px]">✓</span>
                <p className="text-[12px] font-mono text-[#c8c5ca] m-0">
                  Tarjan SCC algorithm detected 0 import cycles. Dependency graph is fully acyclic.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedCycles.map((cycle, idx) => (
                  <div key={idx} className="bg-[#131316] border border-[#27272a] rounded-[6px] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider">
                        Cycle #{idx + 1} ({cycle.length} files)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onNavigateToGraph && (
                          <button
                            type="button"
                            onClick={() => onNavigateToGraph(cycle[0])}
                            className="text-[10px] font-mono text-[#3b82f6] hover:underline cursor-pointer"
                          >
                            Graph
                          </button>
                        )}
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(cycle[0])}
                            className="text-[10px] font-mono text-[#c8c5ca] hover:underline cursor-pointer"
                          >
                            Explorer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cycle loop chain */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[#c8c5ca]">
                      {cycle.map((node, nIdx) => (
                        <React.Fragment key={nIdx}>
                          <span
                            onClick={() => onNavigateToExplorer?.(node)}
                            className="bg-[#18181b] border border-[#27272a] px-1.5 py-0.5 rounded hover:border-[#3b82f6] hover:text-white cursor-pointer truncate max-w-[150px]"
                            title={node}
                          >
                            {node.split('/').pop()}
                          </span>
                          <span className="text-[#919095]">➔</span>
                        </React.Fragment>
                      ))}
                      <span className="text-amber-400 font-semibold text-[10px]">
                        [loop closes]
                      </span>
                    </div>
                  </div>
                ))}

                {circularDependencies.length > 3 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCycles(!showAllCycles)}
                      className="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer"
                    >
                      {showAllCycles ? 'Collapse cycles' : `View all ${circularDependencies.length} cycles`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sub-Section: Centrality Hotspots */}
        <div className="lg:col-span-6 bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-white">
                  High-Centrality Hotspots
                </span>
                <span className="text-[11px] font-mono text-[#919095] block mt-0.5">
                  Top incoming import frequency
                </span>
              </div>
              <Badge variant="neutral" className="text-[10px] font-mono">
                {centralityHotspots.length} ACTIVE
              </Badge>
            </div>

            {centralityHotspots.length === 0 ? (
              <div className="p-4 rounded-[6px] bg-[#131316] border border-[#27272a] text-[12px] font-mono text-[#919095]">
                No centrality hotspots calculated. Codebase appears strictly flat.
              </div>
            ) : (
              <div className="space-y-2">
                {displayedHotspots.map((spot, idx) => {
                  const baseName = spot.filePath.split('/').pop() || spot.filePath;
                  return (
                    <div
                      key={idx}
                      className="bg-[#131316] border border-[#27272a] hover:border-[#39393c] rounded-[6px] px-3 py-2 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[11px] font-mono text-[#919095] font-semibold w-4">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span
                            onClick={() => onNavigateToExplorer?.(spot.filePath)}
                            className="text-[12px] font-mono font-medium text-[#fafafa] hover:text-[#3b82f6] cursor-pointer truncate block max-w-[200px] sm:max-w-[260px]"
                            title={spot.filePath}
                          >
                            {baseName}
                          </span>
                          <span className="text-[10px] font-mono text-[#919095] block truncate max-w-[200px]">
                            {spot.filePath}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-[#adc6ff] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded">
                          {spot.inDegree} in-degree
                        </span>
                        {onNavigateToImpact && (
                          <button
                            type="button"
                            onClick={() => onNavigateToImpact(spot.filePath)}
                            className="px-2 py-0.5 rounded bg-[#1f1f22] hover:bg-[#27272a] text-[10px] font-mono text-[#c8c5ca] hover:text-white border border-[#27272a] cursor-pointer"
                            title="Analyze Blast Radius"
                          >
                            Impact
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {centralityHotspots.length > 5 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllHotspots(!showAllHotspots)}
                      className="text-[11px] font-mono text-[#3b82f6] hover:underline cursor-pointer"
                    >
                      {showAllHotspots ? 'Collapse hotspots' : `View all ${centralityHotspots.length} hotspots`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3D: QUALITY GAPS: UNTESTED SERVICES & DEAD CODE CANDIDATES */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#27272a]/60 pb-3">
          <div>
            <span className="text-[11.5px] font-mono font-bold uppercase tracking-wider text-[#fafafa]">
              Code Quality & Coverage Intelligence
            </span>
            <span className="text-[11px] font-mono text-[#919095] block mt-0.5">
              Discrepancies identified between service definitions, tests, and active import bounds
            </span>
          </div>

          {/* Toggle tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setExpandedQualityTab(expandedQualityTab === 'tests' ? null : 'tests')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                expandedQualityTab === 'tests'
                  ? 'bg-[#1f1f22] text-white border-[#3b82f6]/50'
                  : 'bg-[#131316] text-[#919095] hover:text-white border-[#27272a]'
              }`}
            >
              Missing Tests ({missingTests.length})
            </button>
            <button
              type="button"
              onClick={() => setExpandedQualityTab(expandedQualityTab === 'dead' ? null : 'dead')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                expandedQualityTab === 'dead'
                  ? 'bg-[#1f1f22] text-white border-[#3b82f6]/50'
                  : 'bg-[#131316] text-[#919095] hover:text-white border-[#27272a]'
              }`}
            >
              Dead Code ({deadCode.length})
            </button>
          </div>
        </div>

        {/* Content of expanded drawer */}
        {expandedQualityTab === 'tests' && (
          <div className="pt-3 space-y-2 animate-[fadeIn_0.15s_ease-out]">
            <p className="text-[11.5px] text-[#919095] font-mono">
              Active controllers or services without a corresponding unit or integration test suite detected:
            </p>
            {missingTests.length === 0 ? (
              <p className="text-[12px] font-mono text-emerald-400">✓ All active services have associated test suites.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {missingTests.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#131316] border border-[#27272a] text-[11px] font-mono">
                    <span className="truncate max-w-[240px] text-[#c8c5ca]" title={file}>
                      {file}
                    </span>
                    {onNavigateToExplorer && (
                      <button
                        type="button"
                        onClick={() => onNavigateToExplorer(file)}
                        className="text-[#3b82f6] hover:underline cursor-pointer shrink-0 ml-2"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedQualityTab === 'dead' && (
          <div className="pt-3 space-y-2 animate-[fadeIn_0.15s_ease-out]">
            <p className="text-[11.5px] text-[#919095] font-mono">
              Source files with 0 in-degree that are not designated entrypoints or configuration files:
            </p>
            {deadCode.length === 0 ? (
              <p className="text-[12px] font-mono text-emerald-400">✓ No dead or unreachable code identified.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {deadCode.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#131316] border border-[#27272a] text-[11px] font-mono">
                    <span className="truncate max-w-[240px] text-[#c8c5ca]" title={file}>
                      {file}
                    </span>
                    {onNavigateToExplorer && (
                      <button
                        type="button"
                        onClick={() => onNavigateToExplorer(file)}
                        className="text-[#3b82f6] hover:underline cursor-pointer shrink-0 ml-2"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {expandedQualityTab === null && (
          <div className="pt-2 text-[11px] font-mono text-[#919095] flex items-center gap-4">
            <span>• {missingTests.length} active controllers/services lack test suites</span>
            <span>• {deadCode.length} files detected with 0 incoming references</span>
          </div>
        )}
      </div>
    </section>
  );
};
