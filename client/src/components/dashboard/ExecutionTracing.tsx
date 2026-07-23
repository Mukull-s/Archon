import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Typography, Panel, Badge, Button, Loading, Empty, ErrorState } from '../ui/DesignSystem';

interface FileItem {
  path: string;
  size: number;
  lines: number;
}

interface ExecutionTracingProps {
  repositoryId: string;
  scannedFiles: FileItem[];
  dependencyGraph: Record<string, string[]>;
  astMetadata: Record<string, {
    imports: string[];
    exports: string[];
    classes: any[];
    functions: any[];
  }>;
  onNavigateToExplorer: (filePath: string) => void;
  onTriggerChatQuery: (query: string) => void;
}

interface TraceStep {
  id: string;
  name: string;
  type: 'route' | 'middleware' | 'controller' | 'service' | 'repository' | 'database' | 'external_api' | 'response';
  filePath: string;
  description: string;
  exports: string[];
  functions: string[];
  x: number;
  y: number;
}

// Visual Themes per Node Type
const nodeTypeThemes = {
  route: { color: 'text-[#f43f5e]', border: 'border-[#f43f5e]', bg: 'bg-[#f43f5e]/10', icon: 'login', label: 'Route' },
  middleware: { color: 'text-[#34d399]', border: 'border-[#34d399]', bg: 'bg-[#34d399]/10', icon: 'shield', label: 'Middleware' },
  controller: { color: 'text-[#60a5fa]', border: 'border-[#60a5fa]', bg: 'bg-[#60a5fa]/10', icon: 'router', label: 'Controller' },
  service: { color: 'text-[#eab308]', border: 'border-[#eab308]', bg: 'bg-[#eab308]/10', icon: 'settings_input_component', label: 'Service' },
  repository: { color: 'text-[#fb923c]', border: 'border-[#fb923c]', bg: 'bg-[#fb923c]/10', icon: 'storage', label: 'Repository' },
  database: { color: 'text-[#a855f7]', border: 'border-[#a855f7]', bg: 'bg-[#a855f7]/10', icon: 'database', label: 'Database' },
  external_api: { color: 'text-[#22d3ee]', border: 'border-[#22d3ee]', bg: 'bg-[#22d3ee]/10', icon: 'cloud', label: 'External API' },
  response: { color: 'text-[#ec4899]', border: 'border-[#ec4899]', bg: 'bg-[#ec4899]/10', icon: 'logout', label: 'Response' }
};

export default function ExecutionTracing({
  scannedFiles,
  dependencyGraph = {},
  astMetadata = {},
  onNavigateToExplorer,
  onTriggerChatQuery
}: ExecutionTracingProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'routes' | 'middlewares' | 'jobs'>('all');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Zoom / Pan state for center canvas
  const [zoom, setZoom] = useState(0.9);
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Get all route files in repository
  const entryPoints = useMemo(() => {
    return scannedFiles.map(f => {
      const pathLower = f.path.toLowerCase();
      let type: 'route' | 'middleware' | 'job' = 'route';
      let method = 'GET';

      if (pathLower.includes('middleware') || pathLower.includes('auth') || pathLower.includes('guard')) {
        type = 'middleware';
        method = 'MID';
      } else if (pathLower.includes('job') || pathLower.includes('worker') || pathLower.includes('scheduler')) {
        type = 'job';
        method = 'JOB';
      } else {
        if (pathLower.includes('create') || pathLower.includes('post') || pathLower.includes('upload')) {
          method = 'POST';
        } else if (pathLower.includes('update') || pathLower.includes('put') || pathLower.includes('patch')) {
          method = 'PUT';
        } else if (pathLower.includes('delete') || pathLower.includes('remove')) {
          method = 'DELETE';
        }
      }

      return {
        path: f.path,
        name: f.path.split('/').pop() || f.path,
        type,
        method
      };
    });
  }, [scannedFiles]);

  // Set initial selected route on load
  useEffect(() => {
    const routesOnly = entryPoints.filter(e => e.type === 'route');
    if (routesOnly.length > 0 && !selectedRoute) {
      setSelectedRoute(routesOnly[0].path);
    } else if (entryPoints.length > 0 && !selectedRoute) {
      setSelectedRoute(entryPoints[0].path);
    }
  }, [entryPoints, selectedRoute]);

  // Filter entry points list
  const filteredEntryPoints = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return entryPoints.filter(e => {
      const matchSearch = e.path.toLowerCase().includes(query) || e.name.toLowerCase().includes(query);
      if (filterType === 'routes') return matchSearch && e.type === 'route';
      if (filterType === 'middlewares') return matchSearch && e.type === 'middleware';
      if (filterType === 'jobs') return matchSearch && e.type === 'job';
      return matchSearch;
    });
  }, [entryPoints, searchQuery, filterType]);

  // Traces the pipeline for the selected route and builds coordinates dynamically
  const traceSteps = useMemo((): TraceStep[] => {
    if (!selectedRoute) return [];

    const steps: Omit<TraceStep, 'x' | 'y'>[] = [];
    const visited = new Set<string>();

    const createStep = (filePath: string, type: TraceStep['type']): Omit<TraceStep, 'x' | 'y'> => {
      const ast = astMetadata[filePath] || { exports: [], functions: [], classes: [] };
      let desc = '';
      if (type === 'route') desc = 'Handles HTTP requests and parses endpoint arguments.';
      else if (type === 'middleware') desc = 'Authenticates token claims and validates payload schemas.';
      else if (type === 'controller') desc = 'Unpacks parameters and handles request flow response maps.';
      else if (type === 'service') desc = 'Executes logical transactions and triggers domain tasks.';
      else if (type === 'repository') desc = 'Manages entity queries and abstracts schema layers.';
      else if (type === 'database') desc = 'Maintains connection pools and queries database schemas.';
      else if (type === 'external_api') desc = 'Communicates with third-party external API integrations.';

      // Extract exports names
      const expList = Array.isArray(ast.exports) 
        ? ast.exports 
        : (ast.exports ? Object.keys(ast.exports) : []);

      // Extract functions names
      const fnList = Array.isArray(ast.functions)
        ? ast.functions.map(f => typeof f === 'string' ? f : f?.name || '')
        : [];

      return {
        id: filePath,
        name: filePath.split('/').pop() || filePath,
        type,
        filePath,
        description: desc,
        exports: expList.filter(Boolean),
        functions: fnList.filter(Boolean)
      };
    };

    // 1. Ingress route file
    steps.push(createStep(selectedRoute, 'route'));
    visited.add(selectedRoute);

    const routeDeps = dependencyGraph[selectedRoute] || [];

    // 2. Middlewares
    const middlewares = routeDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('middleware') || dep.toLowerCase().includes('auth') || dep.toLowerCase().includes('guard') || dep.toLowerCase().includes('jwt'))
    );
    middlewares.forEach(mid => {
      steps.push(createStep(mid, 'middleware'));
      visited.add(mid);
    });

    const midDeps = middlewares.flatMap(mid => dependencyGraph[mid] || []);
    const allCurrentDeps = [...routeDeps, ...midDeps];

    // 3. Controllers
    const controllers = allCurrentDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('controller') || dep.toLowerCase().includes('/controllers/'))
    );
    controllers.forEach(ctrl => {
      steps.push(createStep(ctrl, 'controller'));
      visited.add(ctrl);
    });

    const ctrlDeps = controllers.flatMap(ctrl => dependencyGraph[ctrl] || []);
    const allSvcDeps = [...allCurrentDeps, ...ctrlDeps];

    // 4. Services
    const services = allSvcDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('service') || dep.toLowerCase().includes('/services/'))
    );
    services.forEach(svc => {
      steps.push(createStep(svc, 'service'));
      visited.add(svc);
    });

    const svcDeps = services.flatMap(svc => dependencyGraph[svc] || []);
    const allDbDeps = [...allSvcDeps, ...svcDeps];

    // 5. Repositories
    const repos = allDbDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('repository') || dep.toLowerCase().includes('repo') || dep.toLowerCase().includes('model'))
    );
    repos.forEach(repo => {
      steps.push(createStep(repo, 'repository'));
      visited.add(repo);
    });

    // 6. Database / ORM configs
    const dbs = allDbDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('db') || dep.toLowerCase().includes('prisma') || dep.toLowerCase().includes('schema') || dep.toLowerCase().includes('postgres'))
    );
    dbs.forEach(db => {
      steps.push(createStep(db, 'database'));
      visited.add(db);
    });

    // 7. External Integrations
    const apis = allDbDeps.filter(dep => 
      !visited.has(dep) && 
      (dep.toLowerCase().includes('api') || dep.toLowerCase().includes('proxy') || dep.toLowerCase().includes('client') || dep.toLowerCase().includes('resend') || dep.toLowerCase().includes('stripe') || dep.toLowerCase().includes('slack'))
    );
    apis.forEach(api => {
      steps.push(createStep(api, 'external_api'));
      visited.add(api);
    });

    // 8. Exit HTTP Response node
    if (controllers.length > 0 || steps.length > 1) {
      steps.push({
        id: 'response-exit',
        name: 'HTTP Response',
        type: 'response',
        filePath: '',
        description: 'Finalizes execution and returns response headers & status payload.',
        exports: [],
        functions: []
      });
    }

    // Map X & Y coordinates (Vertical flow layout)
    return steps.map((step, idx) => {
      // Linear layout with dynamic spacing
      return {
        ...step,
        x: 300,
        y: 60 + idx * 110
      } as TraceStep;
    });
  }, [selectedRoute, dependencyGraph, astMetadata]);

  const activeStep = traceSteps[activeStepIndex];

  // Helper to center the graph view on a specific node coordinate
  const centerOnNode = (nodeX: number, nodeY: number) => {
    setPan({
      x: 300 - nodeX * zoom,
      y: 200 - nodeY * zoom
    });
  };

  const handleTimelineSelect = (idx: number) => {
    setActiveStepIndex(idx);
    const step = traceSteps[idx];
    if (step) {
      centerOnNode(step.x, step.y);
    }
  };

  // Zoom / Pan actions
  const handleZoom = (factor: number) => {
    setZoom(prev => {
      const z = prev * factor;
      return z < 0.2 ? 0.2 : z > 3 ? 3 : z;
    });
  };

  const handleResetZoom = () => {
    setZoom(0.9);
    setPan({ x: 80, y: 40 });
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

  // Export Trace report
  const handleExport = (format: 'md' | 'json') => {
    if (traceSteps.length === 0) return;
    let dataStr = '';
    let mimeType = 'text/plain';
    let filename = `execution_trace_${selectedRoute.split('/').pop()}`;

    if (format === 'json') {
      dataStr = JSON.stringify(traceSteps, null, 2);
      mimeType = 'application/json';
      filename += '.json';
    } else {
      dataStr = `# EXECUTION FLOW PATH REPORT

**Entry Endpoint Route:** \`${selectedRoute}\`
**Call Chain Length:** ${traceSteps.length} nodes
**Maximum Trace Depth:** ${traceSteps.filter(s => s.type !== 'response').length} levels

## Execution Pipeline Stages
${traceSteps.map((s, i) => `${i + 1}. **[${s.type.toUpperCase()}]** \`${s.name}\`${s.filePath ? ` (\`${s.filePath}\`)` : ''}`).join('\n')}

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
    toast.success(`Exported execution trace as ${format.toUpperCase()}`);
  };

  // Construct context query prompts
  const getAIQuery = (actionType: 'explain' | 'optimize' | 'bottleneck') => {
    const chainStr = traceSteps
      .map((s, i) => `${i + 1}. [${s.type.toUpperCase()}] ${s.name} (${s.filePath || 'HTTP Egress'})`)
      .join('\n');

    if (actionType === 'optimize') {
      return `Recommend optimization options for this execution path:\n${chainStr}\n\nCan you find redundant allocations or clean up logic?`;
    }
    if (actionType === 'bottleneck') {
      return `Identify database, file access, or network API bottleneck points in this execution flow:\n${chainStr}\n\nWhere are we most vulnerable to latency spikes?`;
    }
    return `Explain the request execution flow and how variables pass between layers:\n${chainStr}\n\nProvide a concise analysis.`;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] relative overflow-hidden">
      
      {/* LEFT PANEL: ENTRY POINT EXPLORER */}
      <div className="w-full lg:w-80 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between shrink-0 select-none">
          <span className="text-[10px] font-mono font-bold text-[#919095] tracking-widest uppercase">Entry Points</span>
        </div>

        {/* Filters */}
        <div className="p-2 border-b border-[#27272a]/70 flex gap-1 bg-[#131316]/50 shrink-0">
          {(['all', 'routes', 'middlewares', 'jobs'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-tight cursor-pointer transition-colors ${
                filterType === type
                  ? 'bg-[#1f1f22] text-[#fafafa] font-semibold'
                  : 'text-[#919095] hover:text-[#fafafa]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="p-2 border-b border-[#27272a]/70 shrink-0">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-[4px] pl-8 pr-3 py-1.5 text-[12px] font-mono text-[#fafafa] placeholder-[#919095] focus:outline-none focus:border-[#3b82f6]"
              placeholder="Search entry points..."
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin" data-lenis-prevent>
          {filteredEntryPoints.map(e => (
            <div
              key={e.path}
              onClick={() => {
                setSelectedRoute(e.path);
                setActiveStepIndex(0);
              }}
              className={`p-2 rounded-[4px] cursor-pointer transition-colors select-none flex items-center gap-2 font-mono text-[12px] ${
                selectedRoute === e.path
                  ? 'bg-[#1f1f22] text-[#fafafa] border-l-2 border-[#3b82f6]'
                  : 'hover:bg-[#1f1f22]/50 text-[#c8c5ca] hover:text-[#fafafa]'
              }`}
            >
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] uppercase ${
                e.method === 'POST' ? 'bg-[#93000a]/30 text-[#ffb4ab]' :
                e.method === 'GET' ? 'bg-[#002e6a]/30 text-[#adc6ff]' :
                e.method === 'PUT' ? 'bg-amber-500/20 text-amber-300' :
                e.method === 'DELETE' ? 'bg-red-500/20 text-red-300' :
                'bg-[#1f1f22] text-[#919095]'
              }`}>
                {e.method}
              </span>
              <div className="flex flex-col truncate flex-1">
                <span className="font-semibold truncate">{e.name}</span>
                <span className="text-[9.5px] text-[#919095] truncate">{e.path}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CENTER PANEL: INTERACTIVE CANVAS */}
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

        {/* Vector SVG Canvas */}
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`flex-1 w-full h-full relative outline-none select-none overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}
        >
          {traceSteps.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-8">
              <Empty
                title="Select an Entry Point"
                description="Select an entry point from the list to visualize the request execution flow path."
              />
            </div>
          ) : (
            <svg className="w-full h-full drop-shadow-2xl">
              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                
                {/* Connecting lines (Animated dash curves) */}
                <g fill="none">
                  {traceSteps.map((step, idx) => {
                    if (idx === traceSteps.length - 1) return null;
                    const nextStep = traceSteps[idx + 1];

                    // Curved connection paths
                    const dy = nextStep.y - step.y;
                    const controlY1 = step.y + dy * 0.4;
                    const controlY2 = step.y + dy * 0.6;
                    const pathString = `M ${step.x} ${step.y} C ${step.x} ${controlY1}, ${nextStep.x} ${controlY2}, ${nextStep.x} ${nextStep.y}`;

                    const isHighlight = activeStepIndex === idx || activeStepIndex === idx + 1;

                    return (
                      <path
                        key={idx}
                        d={pathString}
                        className={`transition-colors duration-200 ${isHighlight ? 'stroke-[#60a5fa]' : 'stroke-[#27272a]'}`}
                        strokeWidth={isHighlight ? 2 : 1.5}
                        strokeDasharray={isHighlight ? '4,4' : undefined}
                      />
                    );
                  })}
                </g>

                {/* Nodes */}
                {traceSteps.map((step, idx) => {
                  const theme = nodeTypeThemes[step.type];
                  const isActive = activeStepIndex === idx;

                  return (
                    <g
                      key={step.id}
                      onClick={() => handleTimelineSelect(idx)}
                      className="cursor-pointer group"
                    >
                      {/* Node Shape */}
                      <rect
                        x={step.x - 70}
                        y={step.y - 22}
                        width={140}
                        height={44}
                        rx={6}
                        className={`transition-all duration-200 ${
                          isActive
                            ? 'fill-[#1f1f22] stroke-[#60a5fa] stroke-2 shadow-[0_0_12px_rgba(96,165,251,0.25)]'
                            : 'fill-[#0e0e11] stroke-[#27272a] hover:stroke-[#919095]'
                        }`}
                      />
                      
                      {/* Dot Indicator */}
                      <circle
                        cx={step.x - 52}
                        cy={step.y}
                        r={4}
                        className={theme.color.replace('text', 'fill')}
                      />

                      {/* Icon */}
                      <g transform={`translate(${step.x - 42}, ${step.y - 10})`}>
                        <text
                          className={`material-symbols-outlined text-[16px] select-none ${theme.color}`}
                          style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                        >
                          {theme.icon}
                        </text>
                      </g>

                      {/* Type Label */}
                      <text
                        x={step.x - 22}
                        y={step.y - 4}
                        className="fill-[#919095] font-mono text-[8px] uppercase select-none font-bold"
                      >
                        {theme.label}
                      </text>

                      {/* Name */}
                      <text
                        x={step.x - 22}
                        y={step.y + 10}
                        className="fill-white font-mono text-[10px] select-none font-medium truncate max-w-[80px]"
                      >
                        {step.name.length > 15 ? `${step.name.slice(0, 12)}...` : step.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: DETAILS & TIMELINE */}
      <div className="w-full lg:w-80 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between shrink-0 select-none">
          <span className="text-[10px] font-mono font-bold text-[#919095] tracking-widest uppercase">Details &amp; Timeline</span>
          {traceSteps.length > 0 && (
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
          {traceSteps.length > 0 ? (
            <div className="space-y-5 animate-[fadeIn_0.15s_ease-out]">
              
              {/* Call Chain stats */}
              <div className="grid grid-cols-2 gap-2 bg-[#131316] border border-[#27272a] p-3 rounded-[6px]">
                <div>
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase">Trace Length</span>
                  <span className="text-[18px] font-bold text-[#fafafa] block mt-0.5">{traceSteps.length} nodes</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold text-[#919095] uppercase">Flow Depth</span>
                  <span className="text-[18px] font-bold text-[#60a5fa] block mt-0.5">{traceSteps.filter(s => s.type !== 'response').length} layers</span>
                </div>
              </div>

              {/* Selected Node details */}
              {activeStep && (
                <div className="bg-[#131316] border border-[#27272a] p-4 rounded-[6px] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#27272a]/50 pb-2">
                    <span className="text-[10px] font-mono font-bold text-[#fafafa] uppercase">Active Stage details</span>
                    <Badge variant={activeStep.type === 'route' ? 'info' : 'neutral'} className="uppercase text-[9px] font-mono">
                      {activeStep.type}
                    </Badge>
                  </div>
                  <div>
                    {activeStep.filePath ? (
                      <span
                        onClick={() => onNavigateToExplorer(activeStep.filePath)}
                        className="text-[12px] font-mono text-[#60a5fa] hover:underline cursor-pointer block truncate font-semibold"
                        title="Click to view file"
                      >
                        {activeStep.name}
                      </span>
                    ) : (
                      <span className="text-[12px] font-mono text-white block truncate font-semibold">
                        {activeStep.name}
                      </span>
                    )}
                    {activeStep.filePath && (
                      <span className="text-[9.5px] font-mono text-[#919095] mt-1 block truncate">
                        {activeStep.filePath}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-[#919095] leading-relaxed">
                    {activeStep.description}
                  </p>

                  {/* Exports / Functions */}
                  {activeStep.functions.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[#27272a]/50">
                      <span className="text-[9.5px] font-mono font-bold text-[#919095] uppercase block">Functions Traced ({activeStep.functions.length})</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1" data-lenis-prevent>
                        {activeStep.functions.map(fn => (
                          <span key={fn} className="bg-[#1f1f22] text-[#c8c5ca] border border-[#27272a] rounded px-1.5 py-0.5 text-[9px] font-mono">
                            {fn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Numbered Stages Timeline */}
              <div className="space-y-3">
                <span className="text-[9px] font-mono font-bold text-[#fafafa] uppercase block">Execution Timeline</span>
                <div className="space-y-2 relative border-l border-[#27272a] ml-2 pl-3">
                  {traceSteps.map((step, idx) => {
                    const isActive = activeStepIndex === idx;
                    const theme = nodeTypeThemes[step.type];

                    return (
                      <div
                        key={step.id}
                        onClick={() => handleTimelineSelect(idx)}
                        className={`p-2 rounded cursor-pointer transition-colors relative flex items-center justify-between border ${
                          isActive
                            ? 'bg-[#1f1f22]/70 border-[#60a5fa]/40 text-[#fafafa]'
                            : 'bg-transparent border-transparent hover:bg-[#1f1f22]/30 text-[#c8c5ca]'
                        }`}
                      >
                        <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border bg-[#0e0e11] flex items-center justify-center border-[#27272a]">
                          <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-[#60a5fa]' : 'bg-[#919095]'}`} />
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono text-[#919095]">{idx + 1}</span>
                          <span className="text-[11.5px] font-mono truncate font-semibold">
                            {step.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Actions */}
              <div className="flex flex-col gap-2 pt-3 border-t border-[#27272a]/50">
                <Button
                  variant="primary"
                  onClick={() => onTriggerChatQuery(getAIQuery('explain'))}
                  className="w-full text-[12px] font-mono uppercase py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Explain Execution
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onTriggerChatQuery(getAIQuery('bottleneck'))}
                  className="w-full text-[12px] font-mono uppercase py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Find Bottlenecks
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onTriggerChatQuery(getAIQuery('optimize'))}
                  className="w-full text-[12px] font-mono uppercase py-2 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Suggest Optimization
                </Button>
              </div>

            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#919095] text-[11px] font-mono p-4 text-center">
              Select an entry point route to visualize traces
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
