import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography, Panel, Badge, Button, Loading, Empty, ErrorState } from '../ui/DesignSystem';

interface FileItem {
  path: string;
  size: number;
  lines: number;
}

interface ImpactAnalysisProps {
  repositoryId: string;
  files: FileItem[];
  dependencyGraph: any;
  astMetadata: any;
  onNavigateToExplorer: (filePath: string) => void;
  onTriggerChatQuery: (query: string) => void;
}

interface ImpactResult {
  filePath: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  inDegree: number;
  maxDepth: number;
  affectedFilesCount: number;
  affectedFiles: string[];
  dbModels: string[];
  envVars: string[];
  categories: {
    routes: string[];
    services: string[];
    controllers: string[];
    components: string[];
    others: string[];
  };
  summary: string;
}

// Icon Components
const FileIcon = ({ name }: { name: string }) => {
  const ext = name.split('.').pop()?.toLowerCase();
  let color = 'text-[#c8c5ca]/50';
  if (ext === 'ts' || ext === 'tsx') color = 'text-[#60a5fa]';
  else if (ext === 'js' || ext === 'jsx') color = 'text-[#fcd34d]';
  else if (ext === 'json') color = 'text-[#fb923c]';
  else if (ext === 'md') color = 'text-[#34d399]';
  return (
    <svg className={`w-3.5 h-3.5 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

export default function ImpactAnalysis({
  repositoryId,
  files,
  dependencyGraph,
  astMetadata,
  onNavigateToExplorer,
  onTriggerChatQuery
}: ImpactAnalysisProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'classes' | 'functions'>('all');

  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Zoom / Pan state for Center Canvas
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Trigger simulation call
  const triggerSimulation = async (filePath: string) => {
    setSelectedFile(filePath);
    setAnalyzing(true);
    setResult(null);
    setSimulationError(null);

    // Dynamic loading messages
    setLoadingStep('Analyzing dependency graph...');
    const steps = [
      'Analyzing dependency graph...',
      'Computing blast radius...',
      'Evaluating downstream impact...'
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        setLoadingStep(steps[stepIdx]);
      }
    }, 600);

    try {
      const { data } = await api.post(`/repos/${repositoryId}/impact`, { filePath });
      // Clean intervals
      clearInterval(interval);
      setResult(data.data);
    } catch (err: any) {
      clearInterval(interval);
      setSimulationError(err.message || 'Simulation failed. Codebase graph was unreachable.');
      toast.error('Simulation failed. Codebase graph was unreachable.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Filter Left Panel List
  const filteredList = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return files.filter(f => {
      const ast = astMetadata && astMetadata[f.path];
      const hasClass = ast?.classes?.some((c: any) => c?.name?.toLowerCase()?.includes(query)) || false;
      const hasFunction = ast?.functions?.some((fn: any) => fn?.name?.toLowerCase()?.includes(query)) || false;
      const matchPath = f.path ? f.path.toLowerCase().includes(query) : false;

      if (filterType === 'classes') return hasClass || (matchPath && ast?.classes?.length > 0);
      if (filterType === 'functions') return hasFunction || (matchPath && ast?.functions?.length > 0);
      return matchPath || hasClass || hasFunction;
    });
  }, [files, searchQuery, filterType, astMetadata]);

  // Compute Blast Radius Graph Nodes & Coordinates
  const graphData = useMemo(() => {
    if (!selectedFile) return null;

    // Get direct dependents (Level 1)
    const graph = dependencyGraph || { adjacencyList: {}, dependents: {} };
    const level1 = graph.dependents?.[selectedFile] || [];

    // Get indirect dependents (Level 2)
    const level2Set = new Set<string>();
    level1.forEach((dep: string) => {
      const deps = graph.dependents?.[dep] || [];
      deps.forEach((d: string) => {
        if (d !== selectedFile && !level1.includes(d)) {
          level2Set.add(d);
        }
      });
    });
    const level2 = Array.from(level2Set);

    // Compute coordinate positions (Left-to-right hierarchy layout)
    const nodes: Array<{ id: string; x: number; y: number; level: number; label: string; isSelected: boolean }> = [];
    const edges: Array<{ source: string; target: string; isCritical: boolean }> = [];

    // Root Selected File Node
    const centerY = 280;
    nodes.push({
      id: selectedFile,
      x: 100,
      y: centerY,
      level: 0,
      label: selectedFile.split('/').pop() || '',
      isSelected: true
    });

    // Level 1 Nodes
    const l1Count = level1.length;
    level1.forEach((id: string, idx: number) => {
      const spacing = l1Count > 1 ? 400 / (l1Count - 1) : 0;
      const y = l1Count > 1 ? 80 + idx * spacing : centerY;
      nodes.push({
        id,
        x: 340,
        y,
        level: 1,
        label: id.split('/').pop() || '',
        isSelected: false
      });
      edges.push({
        source: selectedFile,
        target: id,
        isCritical: true // Direct connections marked as critical
      });
    });

    // Level 2 Nodes (connected to Level 1 parent nodes)
    const l2Count = level2.length;
    level2.forEach((id: string, idx: number) => {
      const spacing = l2Count > 1 ? 420 / (l2Count - 1) : 0;
      const y = l2Count > 1 ? 70 + idx * spacing : centerY;
      nodes.push({
        id,
        x: 580,
        y,
        level: 2,
        label: id.split('/').pop() || '',
        isSelected: false
      });

      // Find parent from Level 1
      const parent = level1.find((p: string) => graph.dependents?.[p]?.includes(id));
      if (parent) {
        edges.push({
          source: parent,
          target: id,
          isCritical: false
        });
      } else {
        // Fallback connecting line
        edges.push({
          source: selectedFile,
          target: id,
          isCritical: false
        });
      }
    });

    return { nodes, edges };
  }, [selectedFile, dependencyGraph]);

  // Recommended Review Order (Selected First -> Direct dependents -> Indirect dependents)
  const recommendedReviewOrder = useMemo(() => {
    if (!result) return [];
    const direct = dependencyGraph?.dependents?.[selectedFile || ''] || [];
    const indirect = result.affectedFiles.filter(f => f !== selectedFile && !direct.includes(f));
    return [
      ...(selectedFile ? [selectedFile] : []),
      ...direct,
      ...indirect
    ];
  }, [result, selectedFile, dependencyGraph]);

  // Export report utility
  const handleExport = (format: 'md' | 'json') => {
    if (!result) return;
    let dataStr = '';
    let mimeType = 'text/plain';
    let filename = `impact_report_${result.filePath.split('/').pop()}`;

    if (format === 'json') {
      dataStr = JSON.stringify(result, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    } else {
      dataStr = `# DOWNSTREAM IMPACT ANALYSIS REPORT

**Simulation Target:** \`${result.filePath}\`
**Severity Index:** ${result.riskLevel.toUpperCase()}
**Direct Dependents (In-Degree):** ${result.inDegree}
**Cascade Depth:** ${result.maxDepth}
**Total Affected Files:** ${result.affectedFilesCount}

## AI Cascade Insight
${result.summary}

## Recommended Review Priority Order
${recommendedReviewOrder.map((f, i) => `${i + 1}. \`${f}\``).join('\n')}

---
*Generated by Archon Engineering Intelligence*`;
      mimeType = 'text/markdown';
      filename += '.md';
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported simulation report as ${format.toUpperCase()}`);
  };

  // Zoom / Pan actions
  const handleZoom = (factor: number) => {
    setZoom(prev => {
      const z = prev * factor;
      return z < 0.2 ? 0.2 : z > 3 ? 3 : z;
    });
  };

  const handleResetZoom = () => {
    setZoom(0.85);
    setPan({ x: 50, y: 50 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    handleZoom(factor);
  };

  // Risk meter color scheme mapping
  const riskTheme = useMemo(() => {
    if (!result) return { label: 'LOW', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' };
    const lvl = result.riskLevel.toLowerCase();
    if (lvl === 'critical') return { label: 'CRITICAL', color: 'text-[#ffb4ab]', bg: 'bg-[#93000a]/20', border: 'border-[#93000a]/40', bar: 'bg-[#ffb4ab]' };
    if (lvl === 'high') return { label: 'HIGH', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', bar: 'bg-amber-500' };
    if (lvl === 'medium') return { label: 'MEDIUM', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', bar: 'bg-blue-500' };
    return { label: 'LOW', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', bar: 'bg-emerald-500' };
  }, [result]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] relative overflow-hidden">
      
      {/* LEFT PANEL: SELECTOR LIST */}
      <div className="w-full lg:w-80 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-[#919095] tracking-widest uppercase">Select Target</span>
        </div>

        {/* Filter Selection Tabs */}
        <div className="p-2 border-b border-[#27272a]/70 flex gap-1 bg-[#131316]/50">
          {(['all', 'classes', 'functions'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 py-1 rounded text-[11px] font-mono uppercase tracking-tight cursor-pointer transition-colors ${
                filterType === type
                  ? 'bg-[#1f1f22] text-[#fafafa] font-semibold'
                  : 'text-[#919095] hover:text-[#fafafa]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Search filter input */}
        <div className="p-2 border-b border-[#27272a]/70">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-[4px] pl-8 pr-3 py-1.5 text-[12px] font-mono text-[#fafafa] placeholder-[#919095] focus:outline-none focus:border-[#3b82f6]"
              placeholder={`Search ${filterType === 'all' ? 'files' : filterType}...`}
            />
          </div>
        </div>

        {/* Module target selection scrolling list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin" data-lenis-prevent>
          {filteredList.map(f => (
            <div
              key={f.path}
              onClick={() => triggerSimulation(f.path)}
              className={`p-2 rounded-[4px] cursor-pointer transition-colors select-none flex items-center gap-2.5 font-mono text-[12px] ${
                selectedFile === f.path
                  ? 'bg-[#1f1f22] text-[#fafafa] border-l-2 border-[#3b82f6]'
                  : 'hover:bg-[#1f1f22]/50 text-[#c8c5ca] hover:text-[#fafafa]'
              }`}
            >
              <FileIcon name={f.path.split('/').pop() || ''} />
              <div className="flex flex-col truncate flex-1">
                <span className="font-semibold truncate">{f.path.split('/').pop()}</span>
                <span className="text-[10px] text-[#919095] truncate mt-0.5">{f.path}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER PANEL: BLAST RADIUS VECTOR CANVAS */}
      <div className="flex-1 bg-[#131316] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden relative">
        {/* Canvas Controls */}
        <div className="absolute top-3 left-3 z-10 flex gap-1.5 bg-[#0e0e11]/80 p-1 rounded-[6px] border border-[#27272a] backdrop-blur-sm">
          <button onClick={() => handleZoom(1.15)} className="p-1 rounded hover:bg-[#1f1f22] text-[#919095] hover:text-[#fafafa] cursor-pointer" title="Zoom In" aria-label="Zoom In">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={() => handleZoom(0.85)} className="p-1 rounded hover:bg-[#1f1f22] text-[#919095] hover:text-[#fafafa] cursor-pointer" title="Zoom Out" aria-label="Zoom Out">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
          </button>
          <button onClick={handleResetZoom} className="p-1 rounded hover:bg-[#1f1f22] text-[#919095] hover:text-[#fafafa] cursor-pointer" title="Reset view" aria-label="Reset view">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3-3m-3 3l-3-3" /></svg>
          </button>
        </div>

        {/* Legend */}
        {selectedFile && (
          <div className="absolute bottom-3 right-3 z-10 bg-[#0e0e11]/80 border border-[#27272a] p-2 flex flex-col gap-1 rounded-[6px] backdrop-blur-sm text-[9.5px] font-mono text-[#919095] select-none">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" /> Selected Target</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#fcd34d]" /> Direct Impact</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ff7b72]" /> Critical Path</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#919095]" /> Indirect Impact</div>
          </div>
        )}

        {/* SVG Canvas Area */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`flex-1 w-full h-full relative outline-none select-none overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}
        >
          <AnimatePresence mode="wait">
            {analyzing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131316]/80 backdrop-blur-sm z-20">
                <Loading message={loadingStep} type="spinner" />
              </div>
            ) : simulationError ? (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <ErrorState
                  title="Impact Analysis Failed"
                  description={simulationError}
                  onRetry={() => selectedFile && triggerSimulation(selectedFile)}
                />
              </div>
            ) : !selectedFile ? (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <Empty
                  title="No File Selected"
                  description="Choose a file from the left panel to analyze its downstream impact cascade."
                />
              </div>
            ) : graphData ? (
              /* Layered SVG Graph */
              <svg className="w-full h-full drop-shadow-2xl">
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  
                  {/* Connecting lines/edges */}
                  <g className="stroke-[#27272a] fill-none" strokeWidth="1.5">
                    {graphData.edges.map((edge, index) => {
                      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                      const targetNode = graphData.nodes.find(n => n.id === edge.target);
                      if (!sourceNode || !targetNode) return null;

                      // Bezier curve to make it look extremely premium
                      const dx = targetNode.x - sourceNode.x;
                      const controlX1 = sourceNode.x + dx * 0.4;
                      const controlX2 = sourceNode.x + dx * 0.6;
                      const pathString = `M ${sourceNode.x} ${sourceNode.y} C ${controlX1} ${sourceNode.y}, ${controlX2} ${targetNode.y}, ${targetNode.x} ${targetNode.y}`;

                      return (
                        <path
                          key={index}
                          d={pathString}
                          className={`transition-colors ${edge.isCritical ? 'stroke-[#ff7b72]' : 'stroke-[#27272a]'}`}
                          strokeDasharray={edge.isCritical ? '3,3' : undefined}
                        />
                      );
                    })}
                  </g>

                  {/* Nodes */}
                  {graphData.nodes.map((node) => {
                    const nodeColor = node.level === 0
                      ? 'fill-[#3b82f6]/10 stroke-[#3b82f6] stroke-2'
                      : node.level === 1
                      ? 'fill-[#fcd34d]/10 stroke-[#fcd34d] stroke-1.5'
                      : 'fill-[#131316] stroke-[#919095] stroke-1';

                    const textColor = node.level === 0
                      ? 'fill-white font-bold'
                      : 'fill-[#c8c5ca]';

                    return (
                      <g
                        key={node.id}
                        onClick={() => triggerSimulation(node.id)}
                        className="cursor-pointer group select-none"
                      >
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={node.level === 0 ? 30 : 20}
                          className={`${nodeColor} transition-all duration-200 group-hover:brightness-125`}
                        />
                        {node.level === 0 && (
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={38}
                            className="fill-none stroke-[#3b82f6]/20 stroke-1 animate-[pulse_3s_infinite]"
                          />
                        )}
                        <text
                          x={node.x}
                          y={node.y + (node.level === 0 ? 46 : 34)}
                          textAnchor="middle"
                          className={`${textColor} font-mono text-[10px] pointer-events-none select-none`}
                        >
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT PANEL: SUMMARY & ACTIONS */}
      <div className="w-full lg:w-80 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between shrink-0 select-none">
          <span className="text-[10px] font-mono font-bold text-[#919095] tracking-widest uppercase">Simulation Results</span>
          {result && (
            <div className="flex gap-1.5">
              <button
                onClick={() => handleExport('md')}
                className="p-1 text-[#919095] hover:text-[#fafafa] hover:bg-[#1f1f22] rounded-[4px] cursor-pointer"
                title="Export as Markdown"
                aria-label="Export as Markdown"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="p-1 text-[#919095] hover:text-[#fafafa] hover:bg-[#1f1f22] rounded-[4px] cursor-pointer"
                title="Export as JSON"
                aria-label="Export as JSON"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin" data-lenis-prevent>
          {result ? (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              
              {/* Risk Panel card */}
              <div className="bg-[#131316] border border-[#27272a] p-4 rounded-[6px] relative overflow-hidden flex flex-col gap-3">
                <div className={`absolute top-0 left-0 w-1 h-full ${riskTheme.bar}`} />
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase">Risk Level</span>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-[4px] border uppercase ${riskTheme.color} ${riskTheme.bg} ${riskTheme.border}`}>
                    {riskTheme.label}
                  </span>
                </div>
                <div>
                  <span className="text-[26px] font-display font-extrabold text-[#fafafa] block leading-none">
                    {Math.round(result.riskScore * 100)}%
                  </span>
                  <span className="text-[10px] font-mono text-[#919095] mt-1 block">Blast Severity Index</span>
                </div>
                <div className="w-full bg-[#1f1f22] h-1 rounded-full overflow-hidden">
                  <div className={`h-full ${riskTheme.bar}`} style={{ width: `${result.riskScore * 100}%` }} />
                </div>
              </div>

              {/* Metrics block */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[#131316] border border-[#27272a] p-3 rounded-[6px]">
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase block">Direct Dep.</span>
                  <span className="text-[18px] font-bold text-[#fafafa] mt-1 block">{result.inDegree}</span>
                </div>
                <div className="bg-[#131316] border border-[#27272a] p-3 rounded-[6px]">
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase block">Cascade Depth</span>
                  <span className="text-[18px] font-bold text-[#fafafa] mt-1 block">{result.maxDepth} levels</span>
                </div>
                <div className="bg-[#131316] border border-[#27272a] p-3 rounded-[6px] col-span-2">
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase block">Total Affected Files</span>
                  <span className="text-[18px] font-bold text-[#ffb4ab] mt-1 block">{result.affectedFilesCount} modules</span>
                </div>
              </div>

              {/* AI Insight Summary explanation */}
              {result.summary && (
                <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/10 rounded-[6px] p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#60a5fa] uppercase">
                    <span>⚡</span>
                    <span>AI Cascade Summary</span>
                  </div>
                  <p className="text-[12px] text-[#919095] leading-relaxed break-all">
                    {result.summary.split('\n')[0]} {/* Keep it concise as requested */}
                  </p>
                </div>
              )}

              {/* Recommended Review Order */}
              {recommendedReviewOrder.length > 0 && (
                <div className="bg-[#131316] border border-[#27272a] p-4 rounded-[6px] space-y-3">
                  <span className="text-[9px] font-mono font-bold text-[#fafafa] uppercase block">Recommended Review Order</span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1" data-lenis-prevent>
                    {recommendedReviewOrder.map((filePath, i) => (
                      <div
                        key={filePath}
                        onClick={() => onNavigateToExplorer(filePath)}
                        className="flex items-center justify-between p-2 bg-[#0e0e11] border border-[#27272a]/60 hover:border-[#3b82f6] rounded-[4px] cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono text-[#919095]">{i + 1}</span>
                          <span className="text-[11.5px] font-mono text-[#c8c5ca] group-hover:text-[#3b82f6] truncate">
                            {filePath.split('/').pop()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Actions Row */}
              <div className="flex flex-col gap-2 pt-3 border-t border-[#27272a]/50">
                <Button
                  variant="primary"
                  onClick={() => onTriggerChatQuery(`Explain the cascading downstream impact of modifying ${selectedFile} in detail.`)}
                  className="w-full text-[12px] font-mono uppercase tracking-tight py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Explain Impact
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onTriggerChatQuery(`Suggest a clean refactoring plan to isolate ${selectedFile} and reduce its dependency blast radius.`)}
                  className="w-full text-[12px] font-mono uppercase tracking-tight py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Suggest Refactoring
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onTriggerChatQuery(`Generate a testing strategy and list specific test cases for changes inside ${selectedFile}.`)}
                  className="w-full text-[12px] font-mono uppercase tracking-tight py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Generate Test Strategy
                </Button>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#919095] text-[11px] font-mono p-4 text-center">
              Select a target file to begin simulation details
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
