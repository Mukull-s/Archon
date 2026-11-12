import React from 'react';

interface OverviewTopologyProps {
  architectureType?: string;
  executionFlowStory?: string;
  entryPoints: string[];
  dependencyGraph: Record<string, string[]>;
  calculatedNodesCount: number;
  calculatedEdgesCount: number;
  onNavigateToGraph?: () => void;
  onNavigateToExplorer?: (filePath: string) => void;
}

export const OverviewTopology: React.FC<OverviewTopologyProps> = ({
  architectureType,
  executionFlowStory,
  entryPoints = [],
  dependencyGraph = {},
  calculatedNodesCount = 0,
  calculatedEdgesCount = 0,
  onNavigateToGraph,
  onNavigateToExplorer,
}) => {
  // Render lightweight SVG topology snapshot preview
  const renderTopologyPreview = () => {
    const keys = Object.keys(dependencyGraph).slice(0, 24);
    if (keys.length === 0) {
      return (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[11.5px] text-ink-3">
          No active dependency connections mapped
        </div>
      );
    }

    const nodeCoords = keys.map((key, index) => {
      const angle = (index / keys.length) * 2 * Math.PI;
      const radius = 60 + (index % 3) * 24;
      const x = 200 + Math.cos(angle) * radius;
      const y = 115 + Math.sin(angle) * radius;
      return { id: key, x, y };
    });

    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
    nodeCoords.forEach((node) => {
      const targets = dependencyGraph[node.id] || [];
      targets.forEach((target) => {
        const targetNode = nodeCoords.find((n) => n.id === target);
        if (targetNode) {
          lines.push({
            x1: node.x,
            y1: node.y,
            x2: targetNode.x,
            y2: targetNode.y,
            key: `${node.id}-${target}`,
          });
        }
      });
    });

    return (
      <svg
        className="w-full h-full"
        viewBox="0 0 400 230"
        preserveAspectRatio="xMidYMid slice"
        aria-label="Topology Preview Snapshot"
      >
        {lines.map((line, idx) => (
          <line
            key={line.key || idx}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#3b3f48"
            strokeWidth="0.75"
            strokeOpacity="0.6"
          />
        ))}
        {nodeCoords.map((node) => {
          const isEntry = entryPoints.includes(node.id);
          return (
            <g key={node.id} className="cursor-pointer" onClick={() => onNavigateToExplorer?.(node.id)}>
              <title>{node.id}</title>
              <circle
                cx={node.x}
                cy={node.y}
                r={isEntry ? 5.5 : 3.5}
                fill={isEntry ? '#25d0a0' : '#25282f'}
                stroke={isEntry ? '#25d0a0' : '#4a4f59'}
                strokeWidth={isEntry ? 1.5 : 1}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  // Structured lifecycle steps if not provided as raw string
  const lifecycleSteps = [
    {
      step: '01',
      title: 'Request entry & dispatch',
      desc:
        entryPoints.length > 0
          ? `Incoming traffic hits entry point (${entryPoints[0].split('/').pop()}) and router definitions.`
          : 'Incoming traffic initializes via framework routing bounds.',
      layer: 'Route / gateway',
    },
    {
      step: '02',
      title: 'Controller validation',
      desc: 'Requests are parsed, schema payloads validated, and route parameters unpacked.',
      layer: 'Controller',
    },
    {
      step: '03',
      title: 'Service domain logic',
      desc: 'Business rules execute, state changes orchestrate across core services.',
      layer: 'Service',
    },
    {
      step: '04',
      title: 'Persistence & data models',
      desc: 'Entities query database clients and return typed result sets to caller.',
      layer: 'Model / DB',
    },
  ];

  return (
    <section aria-label="Architecture Topology & Request Flow">
      <div className="panel">
        <div className="panel__head">
          <div className="t">Architecture &amp; request lifecycle</div>
          <div className="r flex items-center gap-3">
            {architectureType && <span className="st st--idle"><i />{architectureType}</span>}
            {onNavigateToGraph && (
              <button type="button" className="abtn abtn--ghost" onClick={onNavigateToGraph}>
                Full graph ›
              </button>
            )}
          </div>
        </div>
        <div className="panel__body">
          {executionFlowStory && (
            <p className="mb-4 border-b border-rule pb-4 text-[13px] leading-[1.65] text-ink-2">
              {executionFlowStory}
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Request Flow Lifecycle */}
            <div className="flex flex-col justify-between gap-4 lg:col-span-7">
              <div className="space-y-2.5">
                <span className="figcap block">Execution flow progression</span>
                {lifecycleSteps.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-[3px] border border-rule bg-paper-3 px-3 py-2.5"
                  >
                    <span className="shrink-0 rounded-[2px] border border-rule-strong px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                      {item.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold text-ink">{item.title}</span>
                        <span className="figcap">{item.layer}</span>
                      </div>
                      <p className="m-0 mt-0.5 font-mono text-[11px] leading-[1.55] text-ink-2">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {entryPoints.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
                  <span className="figcap">Primary entrypoints</span>
                  {entryPoints.slice(0, 3).map((ep, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onNavigateToExplorer?.(ep)}
                      className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[10.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
                      title={`Inspect entry point: ${ep}`}
                    >
                      {ep.split('/').pop()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Lightweight Topology Preview */}
            <div className="flex flex-col gap-2 lg:col-span-5">
              <span className="figcap block">Topology snapshot preview</span>
              <div className="relative h-56 overflow-hidden rounded-[3px] border border-rule bg-plate sm:h-64">
                {renderTopologyPreview()}

                {/* Bottom Floating Stats */}
                <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-[2px] border border-[#31353e] bg-[rgba(23,24,28,.92)] px-2 py-0.5 font-mono text-[10px] text-[#b9c0cb]">
                      {calculatedNodesCount} nodes
                    </span>
                    <span className="rounded-[2px] border border-[#31353e] bg-[rgba(23,24,28,.92)] px-2 py-0.5 font-mono text-[10px] text-[#b9c0cb]">
                      {calculatedEdgesCount} edges
                    </span>
                  </div>
                </div>
              </div>
              {onNavigateToGraph && (
                <button type="button" className="abtn abtn--solid w-full" onClick={onNavigateToGraph}>
                  Explore interactive graph ›
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
