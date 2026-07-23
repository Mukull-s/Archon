import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraphEngine, GraphNode, GraphLink } from './GraphEngine';
import { LayoutEngine, PositionedNode, ClusterBoundary } from './LayoutEngine';
import { Panel, Typography, Button, Loading, Empty, ErrorState } from '../ui/DesignSystem';
import { toast } from 'sonner';
import api from '../../lib/api';

interface FileItem {
  path: string;
  size: number;
  lines: number;
}

interface CodeGraphProps {
  repositoryId: string;
  scannedFiles: FileItem[];
  dependencyGraph: Record<string, string[]>;
  astMetadata: Record<string, any>;
  investigationTarget?: string;
  setInvestigationTarget?: (filePath: string) => void;
}

type TaskViewMode = 'explore' | 'flow' | 'dependency' | 'find';

export default function CodeGraph({
  repositoryId,
  scannedFiles,
  dependencyGraph = {},
  astMetadata = {},
  investigationTarget,
  setInvestigationTarget,
}: CodeGraphProps) {
  // decoupled engine initialization
  const graphEngine = useMemo(() => new GraphEngine(scannedFiles || [], dependencyGraph, astMetadata), [scannedFiles, dependencyGraph, astMetadata]);
  const layoutEngine = useMemo(() => new LayoutEngine(), []);

  // UI state
  const [taskMode, setTaskMode] = useState<TaskViewMode>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; score: number }>>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isMinimapOpen, setIsMinimapOpen] = useState(true);
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // Local fallback if no shared context provider is passed
  const [localSelectedNode, setLocalSelectedNode] = useState<string | null>(null);
  const selectedNode = investigationTarget !== undefined ? investigationTarget : localSelectedNode;

  // Fetch real backend insights dynamically
  const fetchInsights = async (active: boolean) => {
    if (active) {
      setInsightsLoading(true);
      setInsightsError(null);
    }
    try {
      const { data } = await api.get(`/repos/${repositoryId}/insights`);
      if (active) {
        setInsights(data.data);
      }
    } catch (err: any) {
      console.error('Failed to load insights for graph:', err);
      if (active) {
        setInsightsError(err.message || 'Failed to fetch codebase structural insights.');
        toast.error('Could not load structural insights.');
      }
    } finally {
      if (active) {
        setInsightsLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    fetchInsights(active);
    return () => {
      active = false;
    };
  }, [repositoryId]);

  const handleRetryFetch = () => {
    fetchInsights(true);
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const setSelectedNode = (nodeId: string | null) => {
    if (setInvestigationTarget) {
      setInvestigationTarget(nodeId || '');
    } else {
      setLocalSelectedNode(nodeId);
    }
  };

  // Zooming & panning states
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 120, y: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Generate model data
  const rawNodes = useMemo(() => graphEngine.getNodes(), [graphEngine]);
  const rawLinks = useMemo(() => graphEngine.getLinks(), [graphEngine]);

  // Compute Layout positions based on active task intent
  const { positionedNodes, clusters } = useMemo(() => {
    let result: { nodes: PositionedNode[]; clusters: ClusterBoundary[] };
    if (taskMode === 'flow') {
      result = layoutEngine.calculateLayerLayout(rawNodes);
    } else if (taskMode === 'dependency') {
      result = layoutEngine.calculateDependencyLayout(rawNodes);
    } else {
      result = layoutEngine.calculateFolderLayout(rawNodes);
    }
    return { positionedNodes: result.nodes, clusters: result.clusters };
  }, [layoutEngine, rawNodes, taskMode]);

  // Focus Mode details: trace dependencies & downstream blast radius
  const focusContext = useMemo(() => {
    if (!selectedNode) return null;
    const dependents = graphEngine.getDependents(selectedNode);
    const dependencies = graphEngine.getDependencies(selectedNode);
    const blastRadius = graphEngine.getBlastRadius(selectedNode);
    return { dependents, dependencies, blastRadius };
  }, [selectedNode, graphEngine]);

  // Semantic search engine trigger
  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    const results = graphEngine.semanticSearch(searchQuery, rawNodes);
    setSearchResults(results);

    // Auto-focus and center on the highest ranking match
    if (results.length > 0) {
      const match = positionedNodes.find(n => n.id === results[0].id);
      if (match) {
        setPan({ x: 450 - match.x * zoom, y: 250 - match.y * zoom });
      }
    }
  }, [searchQuery, graphEngine, rawNodes, positionedNodes, zoom]);

  // Handle drag pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).tagName === 'circle' ||
      (e.target as HTMLElement).tagName === 'rect' ||
      (e.target as HTMLElement).tagName === 'text' ||
      (e.target as HTMLElement).closest('[data-interactive-node]')
    ) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleZoom = (factor: number) => {
    setZoom(prev => Math.max(0.2, Math.min(3.0, prev * factor)));
  };

  const handleReset = () => {
    setZoom(0.85);
    setPan({ x: 120, y: 70 });
    setSelectedNode(null);
    setSearchQuery('');
  };

  // Derive visual state node status from real repository insights analysis
  const getNodeStatus = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, '/');
    const isCircular = insights?.circularDependencies?.some((cycle: string[]) => 
      cycle.some(c => c.replace(/\\/g, '/').endsWith(normalized) || normalized.endsWith(c.replace(/\\/g, '/')))
    );
    if (isCircular) return 'CRITICAL';
    const isDrift = insights?.architecturalDrift?.some((d: any) => 
      d.filePath.replace(/\\/g, '/').endsWith(normalized) || normalized.endsWith(d.filePath.replace(/\\/g, '/'))
    );
    const isDead = insights?.deadCode?.some((c: string) => 
      c.replace(/\\/g, '/').endsWith(normalized) || normalized.endsWith(c.replace(/\\/g, '/'))
    );
    if (isDrift || isDead) return 'REFACTOR';
    return 'OPTIMAL';
  };

  // Node Color styling based on real status
  const getNodeColor = (status: 'OPTIMAL' | 'REFACTOR' | 'CRITICAL', isSelected: boolean, isHighlighted: boolean) => {
    if (isSelected) return '#3b82f6'; // Focus Blue
    if (isHighlighted) return '#60a5fa'; // Hover Blue
    switch (status) {
      case 'CRITICAL': return '#ef4444'; // Red
      case 'REFACTOR': return '#facc15'; // Yellow
      case 'OPTIMAL': return '#4ade80'; // Green
    }
  };

  const getOuterStrokeColor = (status: 'OPTIMAL' | 'REFACTOR' | 'CRITICAL', isSelected: boolean, isHighlighted: boolean) => {
    if (isSelected) return '#adc6ff';
    if (isHighlighted) return '#3b82f6';
    if (status === 'CRITICAL') return '#93000a';
    return '#c8c6c8';
  };

  // Check if a node is dimmed under focus mode
  const isDimmed = (nodeId: string) => {
    if (!selectedNode) return false;
    if (nodeId === selectedNode) return false;
    if (focusContext?.dependents.includes(nodeId)) return false;
    if (focusContext?.dependencies.includes(nodeId)) return false;
    return true;
  };

  // Get Link rendering style: Solid for direct selection, Dashed for indirect
  const getLinkStyle = (link: GraphLink) => {
    const isSelectedMode = !!selectedNode;
    if (isSelectedMode) {
      const isOut = link.source === selectedNode;
      const isIn = link.target === selectedNode;
      if (isOut || isIn) {
        return {
          color: isOut ? '#a855f7' : '#3b82f6',
          width: 1.5,
          opacity: 0.9,
          dashArray: undefined
        };
      }
      return {
        color: '#47464a',
        width: 0.75,
        opacity: 0.15,
        dashArray: '3,3'
      };
    }
    return {
      color: '#47464a',
      width: 1,
      opacity: 0.4,
      dashArray: undefined
    };
  };

  // Selected Node Details
  const nodeDetails = useMemo(() => {
    if (!selectedNode) return null;
    const nodeObj = positionedNodes.find(n => n.id === selectedNode);
    if (!nodeObj) return null;

    // Onboarding journey pathways
    const entryPointsPaths = (scannedFiles || []).filter(f => f.path.toLowerCase().includes('server') || f.path.toLowerCase().includes('index') || f.path.toLowerCase().includes('app')).map(f => f.path);
    const journey = graphEngine.getJourneyPath(selectedNode, entryPointsPaths);

    // Mock-free explanations grounded in codebase AST structure
    let explanation = `This file declares ${nodeObj.classes.length} classes and ${nodeObj.functions.length} functional entry points.`;
    if (nodeObj.type === 'route') {
      explanation = `Exposes API routes and controller bindings mapping request ingress paths to backend parameters.`;
    } else if (nodeObj.type === 'controller') {
      explanation = `Orchestrates request bodies validation and coordinates database logic queries by executing core services.`;
    } else if (nodeObj.type === 'service') {
      explanation = `Handles business rule logic calculations, transaction validations, and persistence client actions.`;
    } else if (nodeObj.type === 'config') {
      explanation = `Resolves backend configuration environment inputs, schemas mapping, and active connection parameters.`;
    }

    return {
      ...nodeObj,
      status: getNodeStatus(selectedNode),
      journey,
      explanation
    };
  }, [selectedNode, positionedNodes, graphEngine, scannedFiles, insights]);

  // Render loading skeleton during initial insights fetch
  if (insightsLoading && !insights) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-lenis-prevent>
        <Loading message="Building architecture graph..." type="skeleton" />
      </div>
    );
  }

  // Render error state if insights failed
  if (insightsError && !insights) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-lenis-prevent>
        <ErrorState
          title="Architecture analysis failed"
          description={insightsError}
          onRetry={() => fetchInsights(true)}
        />
      </div>
    );
  }

  // Render Empty State if no files or nodes resolved
  if (!scannedFiles || scannedFiles.length === 0 || rawNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]" data-lenis-prevent>
        <Empty
          title="No Mapped Architecture"
          description="Select a repository to generate the architecture graph. Ensure the workspace contains parsed code files (JS, TS, Python, etc.)."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)] min-h-0 w-full" data-lenis-prevent>
      
      {/* ── Control Header ── */}
      <Panel className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0" variant="base">
        {/* Task Views Pivots */}
        <div className="flex bg-[#09090b] border border-[#27272a] rounded-[6px] p-0.5 w-full md:w-auto">
          {[
            { id: 'explore', label: 'Explore Architecture' },
            { id: 'flow', label: 'Trace Request Flow' },
            { id: 'dependency', label: 'Understand Dependencies' },
            { id: 'find', label: 'Find Anything' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => {
                setTaskMode(opt.id as TaskViewMode);
                setSelectedNode(null);
              }}
              className={`flex-1 px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all cursor-pointer ${
                taskMode === opt.id
                  ? 'bg-[#1f1f22] text-[#fafafa] border border-[#27272a] shadow'
                  : 'text-[#71717a] hover:text-[#fafafa]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Semantic Search */}
        <div className="flex items-center gap-2 border border-[#27272a] px-3 py-1.5 bg-[#09090b] rounded-[6px] w-full md:w-72">
          <span className="text-[13px]">🔍</span>
          <input
            type="text"
            placeholder="Search authentication, login, database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-[12px] text-[#fafafa] placeholder-[#71717a] w-full p-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#71717a] text-[11px] hover:text-[#fafafa] cursor-pointer" title="Clear search" aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
      </Panel>

      {/* ── Main Workspace split-screen layout ── */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 w-full relative">
        
        {/* SVG Visualization Canvas */}
        <div className="col-span-12 lg:col-span-8 bg-[#131316] border border-[#27272a] rounded-[8px] h-full relative overflow-hidden select-none graph-canvas">
          
          {/* Active Mode / Loading State Indicator */}
          <div className="absolute top-4 right-4 z-10 bg-[#131316]/85 border border-[#27272a] px-3 py-1.5 rounded-[6px] text-[11px] font-mono text-[#fafafa] flex items-center gap-2 shadow-lg">
            {insightsLoading && (
              <svg className="animate-spin h-3.5 w-3.5 text-secondary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>Mode: {taskMode.toUpperCase()}</span>
          </div>

          {/* Insights Error Banner */}
          {insightsError && (
            <div className="absolute top-4 left-4 z-10 bg-[#ef4444]/15 border border-[#ef4444]/30 px-3 py-1.5 rounded-[6px] text-[10px] font-mono text-[#fca5a5] flex items-center gap-2 shadow-md">
              <span>⚠️ Insights load failed</span>
              <button onClick={handleRetryFetch} className="underline cursor-pointer hover:text-white font-bold ml-1">Retry</button>
            </div>
          )}

          {/* Drag & Pan Canvas Area */}
          <div
            className="w-full h-full cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
          >
            <svg className="w-full h-full">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#27272a" opacity="0.3" />
                </marker>
                <marker id="arrow-out" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
                </marker>
                <marker id="arrow-in" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                
                {/* 1. Directory Clusters Bounding Boxes */}
                {taskMode !== 'dependency' && clusters.map(cluster => (
                  <g key={cluster.id} className="transition-all duration-300">
                    <rect
                      x={cluster.minX}
                      y={cluster.minY}
                      width={cluster.width}
                      height={cluster.height}
                      rx={6}
                      fill="#131316"
                      fillOpacity={0.4}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth={1}
                      strokeDasharray="4,2"
                    />
                    <text
                      x={cluster.minX + 14}
                      y={cluster.minY + 24}
                      fill="#919095"
                      fontSize={10}
                      fontFamily="JetBrains Mono"
                      fontWeight={600}
                      className="opacity-40 uppercase tracking-widest pointer-events-none select-none"
                    >
                      MODULE: {cluster.name}
                    </text>
                  </g>
                ))}

                {/* 2. Relationship Links (SVG Curves) */}
                {rawLinks.map((link, idx) => {
                  const srcNode = positionedNodes.find(n => n.id === link.source);
                  const tgtNode = positionedNodes.find(n => n.id === link.target);
                  if (!srcNode || !tgtNode) return null;

                  const style = getLinkStyle(link);
                  
                  // Compute curved line paths
                  const dx = tgtNode.x - srcNode.x;
                  const dy = tgtNode.y - srcNode.y;
                  const dr = Math.sqrt(dx * dx + dy * dy) * 1.2;

                  return (
                    <path
                      key={idx}
                      d={`M ${srcNode.x} ${srcNode.y} A ${dr} ${dr} 0 0 1 ${tgtNode.x} ${tgtNode.y}`}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={style.width}
                      strokeOpacity={style.opacity}
                      strokeDasharray={style.dashArray}
                      markerEnd={
                        selectedNode 
                          ? (link.source === selectedNode ? "url(#arrow-out)" : (link.target === selectedNode ? "url(#arrow-in)" : "none"))
                          : "url(#arrow)"
                      }
                      className="transition-all duration-200"
                    />
                  );
                })}

                {/* 3. HTML Absolute Overlay Nodes */}
                {positionedNodes.map(node => {
                  const isNodeSelected = selectedNode === node.id;
                  const isNodeHovered = hoveredNodeId === node.id;
                  const dim = isDimmed(node.id);
                  const isSearchResult = searchResults.some(r => r.id === node.id);
                  const status = getNodeStatus(node.id);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      className={`cursor-pointer transition-all duration-200`}
                      style={{ opacity: dim ? 0.08 : 1 }}
                      onClick={() => setSelectedNode(isNodeSelected ? null : node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      data-interactive-node
                    >
                      {/* Search Result ring */}
                      {isSearchResult && (
                        <circle r={node.size + 14} fill="none" stroke="#fcd34d" strokeWidth={2} strokeDasharray="3,3" className="animate-spin" style={{ animationDuration: '6s' }} />
                      )}

                      {/* Custom Node shape with status border */}
                      <circle
                        r={node.size}
                        fill="#131316"
                        stroke={getOuterStrokeColor(status, isNodeSelected, isNodeHovered)}
                        strokeWidth={isNodeSelected ? 2.5 : 1.5}
                        className="transition-all duration-150"
                      />

                      {/* Status indicator Center Dot */}
                      <circle
                        r={isNodeSelected ? 5 : 4}
                        fill={getNodeColor(status, isNodeSelected, isNodeHovered)}
                      />

                      {/* Floating Text Label */}
                      <text
                        y={node.size + 14}
                        textAnchor="middle"
                        fill={isNodeSelected ? '#fafafa' : '#c8c5ca'}
                        fontSize={10}
                        fontWeight={isNodeSelected ? 600 : 400}
                        fontFamily="Inter"
                        className="pointer-events-none select-none group-hover:fill-secondary transition-colors"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}

              </g>
            </svg>
          </div>

          {/* IDE-style Navigation Controls */}
          <div className="absolute bottom-6 left-6 flex items-center gap-3 z-10">
            <div className="flex bg-[#1f1f22]/90 backdrop-blur border border-[#27272a] rounded-[4px] overflow-hidden p-0.5 shadow-lg">
              <button 
                onClick={() => handleZoom(1.15)}
                className="p-1.5 hover:bg-[#2a2a2d] text-[#c8c5ca] hover:text-[#fafafa] transition-colors rounded-sm cursor-pointer" 
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <div className="w-[1px] bg-[#27272a] my-1"></div>
              <button 
                onClick={() => handleZoom(0.85)}
                className="p-1.5 hover:bg-[#2a2a2d] text-[#c8c5ca] hover:text-[#fafafa] transition-colors rounded-sm cursor-pointer" 
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                </svg>
              </button>
              <div className="w-[1px] bg-[#27272a] my-1"></div>
              <button 
                onClick={handleReset}
                className="p-1.5 hover:bg-[#2a2a2d] text-[#c8c5ca] hover:text-[#fafafa] transition-colors rounded-sm cursor-pointer" 
                title="Reset View"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-6-6m0 0l-6 6m6-6v12M9 9h12" />
                </svg>
              </button>
            </div>
            {/* Minimap Toggle Button */}
            <button 
              onClick={() => setIsMinimapOpen(!isMinimapOpen)}
              title={isMinimapOpen ? 'Hide minimap' : 'Show minimap'}
              aria-label={isMinimapOpen ? 'Hide minimap' : 'Show minimap'}
              className="bg-[#1f1f22]/90 backdrop-blur border border-[#27272a] px-3 py-1.5 rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] hover:bg-[#2a2a2d] transition-colors flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A2 2 0 013 15.382V5.618a2 2 0 011.553-1.894L9 2l5.447 2.724A2 2 0 0115 6.618v9.764a2 2 0 01-1.553 1.894L9 20z" />
              </svg>
              <span className="text-[11px] font-mono tracking-wider font-semibold uppercase">Minimap</span>
            </button>
          </div>

          {/* Legend Capsule */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-[#131316]/80 backdrop-blur-md border border-[#27272a] px-4 py-2 rounded-full z-10 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4ade80]"></div>
              <span className="text-[11px] font-mono text-[#c8c5ca] uppercase">OPTIMAL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#facc15]"></div>
              <span className="text-[11px] font-mono text-[#c8c5ca] uppercase">REFACTOR</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
              <span className="text-[11px] font-mono text-[#c8c5ca] uppercase">CRITICAL</span>
            </div>
            <div className="h-3 w-[1px] bg-[#27272a]"></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-[#919095]"></div>
                <span className="text-[10px] font-mono text-[#c8c5ca] opacity-60 uppercase">DIRECT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 border-t border-dashed border-[#919095]"></div>
                <span className="text-[10px] font-mono text-[#c8c5ca] opacity-60 uppercase">INDIRECT</span>
              </div>
            </div>
          </div>

          {/* ── Viewport Minimap Navigator ── */}
          {isMinimapOpen && (
            <div className="absolute bottom-6 right-6 w-36 h-28 bg-[#131316]/90 border border-[#27272a] rounded-[6px] overflow-hidden pointer-events-none z-10 flex flex-col justify-between p-1.5 shadow-2xl">
              <div className="text-[8px] font-mono text-[#71717a] uppercase tracking-wider">Mini-Map</div>
              <div className="w-full h-20 bg-[#09090b] relative border border-[#27272a]/50 rounded-[4px] overflow-hidden">
                {positionedNodes.map(node => (
                  <div
                    key={node.id}
                    className="absolute rounded-full"
                    style={{
                      left: `${(node.x / 1200) * 100}%`,
                      top: `${(node.y / 800) * 100}%`,
                      width: '3px',
                      height: '3px',
                      backgroundColor: getNodeColor(getNodeStatus(node.id), false, false),
                    }}
                  />
                ))}

                <div
                  className="absolute border border-[#3b82f6] bg-[#3b82f6]/5 transition-all duration-150"
                  style={{
                    left: `${(-pan.x / (1200 * zoom)) * 100}%`,
                    top: `${(-pan.y / (800 * zoom)) * 100}%`,
                    width: `${(900 / (1200 * zoom)) * 100}%`,
                    height: `${(550 / (800 * zoom)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

        </div>

        {/* ── Right Column: Details Drawer ── */}
        <aside className="col-span-12 lg:col-span-4 h-full flex flex-col bg-[#131316] border border-[#27272a] rounded-[8px] overflow-hidden" id="detail-panel">
          <AnimatePresence mode="wait">
            {nodeDetails ? (
              <motion.div
                key={nodeDetails.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col h-full min-h-0"
              >
                {/* Panel Header */}
                <div className="p-6 border-b border-[#27272a] bg-[#1b1b1e]/50 flex justify-between items-start flex-shrink-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-secondary uppercase tracking-widest mb-1 block">
                      {nodeDetails.type.toUpperCase()} DETAILS
                    </span>
                    <h2 className="font-display text-[18px] font-bold text-on-surface truncate break-all leading-tight">
                      {nodeDetails.label}
                    </h2>
                    <span className="text-[10px] font-mono text-on-surface-variant/60 block mt-1 truncate break-all">
                      {nodeDetails.id}
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedNode(null)}
                    className="text-on-surface-variant hover:text-primary p-1 cursor-pointer shrink-0 ml-2"
                  >
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Panel Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 min-h-0" data-lenis-prevent>
                  
                  {/* File Purpose Description */}
                  <div>
                    <h4 className="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider mb-2">File Purpose</h4>
                    <Typography variant="body-sm" className="text-[#c8c5ca] leading-relaxed">
                      {nodeDetails.explanation}
                    </Typography>
                  </div>

                  {/* Metrics Grid */}
                  <section>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#1b1b1e] border border-[#27272a] p-3.5 rounded-sm">
                        <span className="block text-[9px] font-mono text-on-surface-variant uppercase mb-1">Dependents</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-mono font-bold text-on-surface">{nodeDetails.inDegree}</span>
                          <span className="text-[9px] text-on-surface-variant uppercase">inbound</span>
                        </div>
                      </div>
                      <div className="bg-[#1b1b1e] border border-[#27272a] p-3.5 rounded-sm">
                        <span className="block text-[9px] font-mono text-on-surface-variant uppercase mb-1">Dependencies</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-mono font-bold text-on-surface">{nodeDetails.outDegree}</span>
                          <span className="text-[9px] text-on-surface-variant uppercase">outbound</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Journey Path */}
                  {nodeDetails.journey && nodeDetails.journey.length > 0 && (
                    <div className="bg-[#09090b] border border-[#27272a] p-3.5 rounded-[6px]">
                      <Typography variant="label-caps" className="text-[#3b82f6] mb-3 block">Logical Journey Path</Typography>
                      <div className="flex flex-col gap-2 font-mono text-[11px]">
                        {nodeDetails.journey.map((step: string, idx: number) => (
                          <div key={step} className="flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-sans shrink-0 ${
                              step === selectedNode ? 'bg-[#3b82f6] text-white' : 'bg-[#27272a] text-[#71717a]'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className={step === selectedNode ? 'text-[#fafafa] font-semibold truncate' : 'text-[#71717a] truncate'}>
                              {step.split('/').pop()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interface Map: Classes & Functions */}
                  {((nodeDetails.classes && nodeDetails.classes.length > 0) || (nodeDetails.functions && nodeDetails.functions.length > 0)) && (
                    <section>
                      <h4 className="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider mb-3">Interface Map</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {nodeDetails.classes.map((cls: string) => (
                          <div key={cls} className="flex items-center gap-2.5 p-2 bg-[#1b1b1e]/50 border border-[#27272a]/30 rounded-sm hover:border-[#27272a] transition-colors">
                            <svg className="w-4 h-4 text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                            </svg>
                            <span className="font-mono text-[12px] text-[#fafafa] truncate">{cls}</span>
                          </div>
                        ))}
                        {nodeDetails.functions.map((func: string) => (
                          <div key={func} className="flex items-center gap-2.5 p-2 bg-[#1b1b1e]/50 border border-[#27272a]/30 rounded-sm hover:border-[#27272a] transition-colors">
                            <svg className="w-4 h-4 text-secondary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                            </svg>
                            <span className="font-mono text-[12px] text-[#fafafa] truncate">{func}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}


                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                <svg className="w-12 h-12 mb-4 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94-3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <Typography variant="body-sm" className="px-10 leading-relaxed text-[#c8c5ca]">
                  Select any node in the graph to view detailed dependency analysis and complexity metrics.
                </Typography>
              </div>
            )}
          </AnimatePresence>
        </aside>

      </div>
    </div>
  );
}
