import React from 'react';
import { Panel, Typography, Button, Badge } from '../../ui/DesignSystem';

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
  architectureType = 'Layered Modular Architecture',
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
        <div className="absolute inset-0 flex items-center justify-center text-[#919095] font-mono text-[11.5px]">
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
      <svg className="w-full h-full" style={{ background: '#0e0e11' }} aria-label="Topology Preview Snapshot">
        {lines.map((line, idx) => (
          <line
            key={line.key || idx}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#39393c"
            strokeWidth="0.75"
            strokeOpacity="0.45"
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
                fill={isEntry ? '#3b82f6' : '#18181b'}
                stroke={isEntry ? '#93c5fd' : '#52525b'}
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
      title: 'Request Entry & Dispatch',
      desc: entryPoints.length > 0 
        ? `Incoming traffic hits entry point (${entryPoints[0].split('/').pop()}) and router definitions.`
        : 'Incoming traffic initializes via framework routing bounds.',
      layer: 'Route / Gateway Layer'
    },
    {
      step: '02',
      title: 'Controller Validation',
      desc: 'Requests are parsed, schema payloads validated, and route parameters unpacked.',
      layer: 'Controller Layer'
    },
    {
      step: '03',
      title: 'Service Domain Logic',
      desc: 'Business rules execute, state changes orchestrate across core services.',
      layer: 'Service Layer'
    },
    {
      step: '04',
      title: 'Persistence & Data Models',
      desc: 'Entities query database clients and return typed result sets to caller.',
      layer: 'Model / DB Layer'
    }
  ];

  return (
    <section 
      aria-label="Architecture Topology & Request Flow" 
      className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 my-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#27272a]/60 pb-3.5 mb-5 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
          <h2 className="text-[12px] font-mono font-bold text-white uppercase tracking-wider m-0">
            System Architecture & Request Lifecycle
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#adc6ff] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2.5 py-0.5 rounded">
            {architectureType}
          </span>
          {onNavigateToGraph && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onNavigateToGraph}
              className="text-[11px] font-mono gap-1.5"
            >
              <span>Full Graph</span>
              <span className="text-[#3b82f6]">➔</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Request Flow Lifecycle */}
        <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#919095] block">
              Execution Flow Progression
            </span>
            {lifecycleSteps.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-[#131316] border border-[#27272a] hover:border-[#39393c] p-3 rounded-[6px] flex items-start gap-3 transition-colors"
              >
                <span className="text-[11px] font-mono font-bold text-[#3b82f6] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 border border-[#3b82f6]/20 shrink-0">
                  {item.step}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono font-semibold text-white">
                      {item.title}
                    </span>
                    <span className="text-[9.5px] font-mono text-[#919095] uppercase">
                      {item.layer}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#c8c5ca] font-mono mt-0.5 leading-relaxed m-0">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {entryPoints.length > 0 && (
            <div className="pt-2 flex items-center gap-2 text-[11px] font-mono text-[#919095]">
              <span>Primary Entrypoints:</span>
              <div className="flex flex-wrap gap-1.5">
                {entryPoints.slice(0, 3).map((ep, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onNavigateToExplorer?.(ep)}
                    className="text-[#adc6ff] hover:underline cursor-pointer bg-[#18181b] px-2 py-0.5 rounded border border-[#27272a]"
                    title={`Inspect entry point: ${ep}`}
                  >
                    {ep.split('/').pop()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Lightweight Topology Preview */}
        <div className="lg:col-span-5 flex flex-col justify-between">
          <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#919095] block mb-2">
            Topology Snapshot Preview
          </span>
          <div className="h-56 sm:h-64 border border-[#27272a] rounded-[6px] relative overflow-hidden bg-[#0e0e11]">
            {renderTopologyPreview()}

            {/* Bottom Floating Stats */}
            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-[#131316]/90 border border-[#27272a] rounded text-[10px] font-mono text-[#c8c5ca]">
                  {calculatedNodesCount} nodes
                </span>
                <span className="px-2 py-0.5 bg-[#131316]/90 border border-[#27272a] rounded text-[10px] font-mono text-[#c8c5ca]">
                  {calculatedEdgesCount} edges
                </span>
              </div>
              {onNavigateToGraph && (
                <button
                  type="button"
                  onClick={onNavigateToGraph}
                  className="pointer-events-auto px-2.5 py-1 rounded bg-[#3b82f6] hover:bg-blue-600 text-white text-[10px] font-mono font-medium shadow-md transition-colors cursor-pointer"
                >
                  Explore Interactive Graph ➔
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
