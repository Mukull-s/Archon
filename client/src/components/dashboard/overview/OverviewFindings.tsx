import React, { useState } from 'react';

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
  const maxInDegree = centralityHotspots.reduce((max, spot) => Math.max(max, spot.inDegree), 0);

  return (
    <section id="overview-findings" aria-label="Architectural Health and Critical Findings" className="scroll-mt-6">
      <div className="panel mb-6">
        <div className="panel__head">
          <div className="t">Architectural health &amp; critical findings</div>
          <div className="r">
            {totalIssueCount > 0 ? (
              <span className="st st--warn">
                <i />
                {totalIssueCount} {totalIssueCount === 1 ? 'condition requiring review' : 'conditions requiring review'}
              </span>
            ) : (
              <span className="st st--ok">
                <i />
                Clean architecture state
              </span>
            )}
          </div>
        </div>
        <div className="panel__body">
          {/* ── 3A: ARCHITECTURAL DRIFT INSPECTOR ──────────────────────── */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="figcap">Layer drift &amp; boundary violations</span>
              <span className="figcap"><b>{architecturalDrift.length}</b></span>
            </div>
            <span className="figcap hidden sm:inline">Route ➔ Controller ➔ Service ➔ Database</span>
          </div>

          {architecturalDrift.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[3px] border border-rule bg-paper-3 px-4 py-3">
              <span className="font-mono text-[13px] text-emerald">✓</span>
              <p className="m-0 text-[12.5px] leading-[1.6] text-ink-2">
                No architectural layer drift detected. Clean unidirectional boundaries preserved across
                controllers, services, and models.
              </p>
            </div>
          ) : (
            <div className="findings">
              {displayedDrift.map((finding, idx) => {
                const sourceBase = finding.filePath.split('/').pop() || finding.filePath;
                const targetBase = finding.targetPath.split('/').pop() || finding.targetPath;

                return (
                  <div key={idx} className="finding finding--risk">
                    <div className="finding__bar" />
                    <div className="finding__body">
                      <div className="finding__top">
                        <span className="finding__t">
                          <span
                            className="cursor-pointer hover:text-emerald"
                            title={finding.filePath}
                            onClick={() => onNavigateToExplorer?.(finding.filePath)}
                          >
                            {sourceBase}
                          </span>
                          <span className="px-2 text-sig">➔</span>
                          <span
                            className="cursor-pointer font-normal text-ink-2 hover:text-emerald"
                            title={finding.targetPath}
                            onClick={() => onNavigateToExplorer?.(finding.targetPath)}
                          >
                            {targetBase}
                          </span>
                        </span>
                      </div>
                      <p className="finding__d m-0">{finding.violation}</p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(finding.filePath)}
                            className="abtn abtn--ghost"
                            title={`Open ${finding.filePath} in Explorer`}
                          >
                            Open file
                          </button>
                        )}
                        {onNavigateToGraph && (
                          <button
                            type="button"
                            onClick={() => onNavigateToGraph(finding.filePath)}
                            className="abtn abtn--ghost"
                            title={`View ${finding.filePath} in Architecture Graph`}
                          >
                            View graph
                          </button>
                        )}
                        {onNavigateToImpact && (
                          <button
                            type="button"
                            onClick={() => onNavigateToImpact(finding.filePath)}
                            className="abtn abtn--ghost"
                            title={`Analyze blast radius of ${finding.filePath}`}
                          >
                            Check impact
                          </button>
                        )}
                        {onTriggerChat && (
                          <button
                            type="button"
                            onClick={() =>
                              onTriggerChat(
                                `Explain how to refactor ${finding.filePath} to fix this layer violation: ${finding.violation}`
                              )
                            }
                            className="abtn abtn--solid"
                            title="Ask AI how to refactor this violation"
                          >
                            Explain fix
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {architecturalDrift.length > 4 && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => setShowAllDrift(!showAllDrift)}
                className="figcap hover:text-ink"
              >
                {showAllDrift
                  ? 'Collapse drift list'
                  : `Show all ${architecturalDrift.length} layer drift violations`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 3B & 3C: CIRCULAR DEPENDENCIES & CENTRALITY HOTSPOTS ───────── */}
      <div className="ksplit--even mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Circular Dependencies */}
        <div className="panel flex flex-col">
          <div className="panel__head">
            <div className="t">Circular dependency loops</div>
            <div className="r">
              <span className="figcap"><b>{circularDependencies.length}</b></span>
            </div>
          </div>
          <div className="panel__body flex-1">
            {circularDependencies.length === 0 ? (
              <div className="flex items-center gap-3 rounded-[3px] border border-rule bg-paper-3 px-4 py-3">
                <span className="font-mono text-[13px] text-emerald">✓</span>
                <p className="m-0 text-[12px] leading-[1.6] text-ink-2">
                  Tarjan SCC algorithm detected 0 import cycles. Dependency graph is fully acyclic.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedCycles.map((cycle, idx) => (
                  <div key={idx} className="rounded-[3px] border border-rule bg-paper-3 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="figcap">
                        <b>Cycle #{idx + 1}</b> · {cycle.length} files
                      </span>
                      <div className="flex items-center gap-3">
                        {onNavigateToGraph && (
                          <button
                            type="button"
                            onClick={() => onNavigateToGraph(cycle[0])}
                            className="figcap hover:text-ink"
                          >
                            Graph
                          </button>
                        )}
                        {onNavigateToExplorer && (
                          <button
                            type="button"
                            onClick={() => onNavigateToExplorer(cycle[0])}
                            className="figcap hover:text-ink"
                          >
                            Explorer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Cycle loop chain */}
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-2">
                      {cycle.map((node, nIdx) => (
                        <React.Fragment key={nIdx}>
                          <span
                            onClick={() => onNavigateToExplorer?.(node)}
                            className="max-w-[150px] cursor-pointer truncate rounded-[2px] border border-rule px-1.5 py-0.5 transition-colors hover:border-ink hover:text-ink"
                            title={node}
                          >
                            {node.split('/').pop()}
                          </span>
                          <span className="text-ink-3">➔</span>
                        </React.Fragment>
                      ))}
                      <span className="figcap">[loop closes]</span>
                    </div>
                  </div>
                ))}

                {circularDependencies.length > 3 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCycles(!showAllCycles)}
                      className="figcap hover:text-ink"
                    >
                      {showAllCycles ? 'Collapse cycles' : `View all ${circularDependencies.length} cycles`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Centrality Hotspots */}
        <div className="panel flex flex-col">
          <div className="panel__head">
            <div className="t">High-centrality hotspots</div>
            <div className="r">Top incoming import frequency</div>
          </div>
          <div className="panel__body flex-1">
            {centralityHotspots.length === 0 ? (
              <div className="rounded-[3px] border border-rule bg-paper-3 px-4 py-3 text-[12px] text-ink-3">
                No centrality hotspots calculated. Codebase appears strictly flat.
              </div>
            ) : (
              <div className="hot -mx-4">
                {displayedHotspots.map((spot, idx) => {
                  const baseName = spot.filePath.split('/').pop() || spot.filePath;
                  const pct = maxInDegree > 0 ? Math.round((spot.inDegree / maxInDegree) * 100) : 0;
                  return (
                    <div key={idx}>
                      <div className="hotrow">
                        <span className="rk">#{idx + 1}</span>
                        <span
                          onClick={() => onNavigateToExplorer?.(spot.filePath)}
                          className="p cursor-pointer hover:text-emerald"
                          title={spot.filePath}
                        >
                          {baseName}
                        </span>
                        <span className="cents">{spot.inDegree} in</span>
                        {onNavigateToImpact ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToImpact(spot.filePath)}
                            className="figcap text-right hover:text-ink"
                            title="Analyze Blast Radius"
                          >
                            Impact
                          </button>
                        ) : (
                          <span className="figcap text-right">—</span>
                        )}
                        <span className="bar">
                          <i style={{ width: `${pct}%` }} />
                        </span>
                      </div>
                    </div>
                  );
                })}

                {centralityHotspots.length > 5 && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllHotspots(!showAllHotspots)}
                      className="figcap hover:text-ink"
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

      {/* ── 3D: QUALITY GAPS: UNTESTED SERVICES & DEAD CODE CANDIDATES ─── */}
      <div className="panel">
        <div className="panel__head">
          <div className="t">Code quality &amp; coverage intelligence</div>
          <div className="r">Discrepancies between service definitions, tests, and active import bounds</div>
        </div>
        <div className="panel__body">
          {/* Toggle tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedQualityTab(expandedQualityTab === 'tests' ? null : 'tests')}
              className={`abtn ${expandedQualityTab === 'tests' ? 'abtn--solid' : 'abtn--ghost'}`}
            >
              Missing tests ({missingTests.length})
            </button>
            <button
              type="button"
              onClick={() => setExpandedQualityTab(expandedQualityTab === 'dead' ? null : 'dead')}
              className={`abtn ${expandedQualityTab === 'dead' ? 'abtn--solid' : 'abtn--ghost'}`}
            >
              Dead code ({deadCode.length})
            </button>
          </div>

          {expandedQualityTab === 'tests' && (
            <div className="mt-4 animate-[fadeIn_0.15s_ease-out] space-y-2 border-t border-rule pt-4">
              <p className="m-0 font-mono text-[11.5px] text-ink-3">
                Active controllers or services without a corresponding unit or integration test suite
                detected:
              </p>
              {missingTests.length === 0 ? (
                <p className="m-0 font-mono text-[12px] text-emerald">
                  ✓ All active services have associated test suites.
                </p>
              ) : (
                <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {missingTests.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-[2px] border border-rule bg-paper-3 p-2 font-mono text-[11px]"
                    >
                      <span className="max-w-[240px] truncate text-ink-2" title={file}>
                        {file}
                      </span>
                      {onNavigateToExplorer && (
                        <button
                          type="button"
                          onClick={() => onNavigateToExplorer(file)}
                          className="figcap ml-2 shrink-0 hover:text-ink"
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
            <div className="mt-4 animate-[fadeIn_0.15s_ease-out] space-y-2 border-t border-rule pt-4">
              <p className="m-0 font-mono text-[11.5px] text-ink-3">
                Source files with 0 in-degree that are not designated entrypoints or configuration files:
              </p>
              {deadCode.length === 0 ? (
                <p className="m-0 font-mono text-[12px] text-emerald">
                  ✓ No dead or unreachable code identified.
                </p>
              ) : (
                <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {deadCode.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-[2px] border border-rule bg-paper-3 p-2 font-mono text-[11px]"
                    >
                      <span className="max-w-[240px] truncate text-ink-2" title={file}>
                        {file}
                      </span>
                      {onNavigateToExplorer && (
                        <button
                          type="button"
                          onClick={() => onNavigateToExplorer(file)}
                          className="figcap ml-2 shrink-0 hover:text-ink"
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
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-ink-3">
              <span>• {missingTests.length} active controllers/services lack test suites</span>
              <span>• {deadCode.length} files detected with 0 incoming references</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
