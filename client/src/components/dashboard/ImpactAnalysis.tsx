import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../../lib/api';
import { detectArchitecturalRole } from './explorer/explorerUtils';
import { ArchitecturalRole, FileItem } from './explorer/explorerTypes';

export interface ImpactAnalysisProps {
  repositoryId: string;
  files: FileItem[];
  dependencyGraph: Record<string, string[]>;
  astMetadata?: Record<string, any>;
  investigationTarget?: string | null;
  onSelectInvestigationTarget?: (filePath: string) => void;
  onNavigateToExplorer: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToTrace?: (filePath?: string) => void;
  onTriggerChatQuery: (query: string) => void;
  entryPoints?: string[];
  framework?: string | null;
}

interface ImpactResult {
  filePath: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'low' | 'medium' | 'high' | 'critical';
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

// Role color helpers matching Archon design system
function getRoleBadgeStyle(role: ArchitecturalRole) {
  switch (role) {
    case 'ENTRY POINT':
      return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
    case 'ROUTE':
      return 'bg-blue-950/70 text-blue-300 border-blue-800/60';
    case 'CONTROLLER':
      return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60';
    case 'SERVICE':
      return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
    case 'MODEL':
      return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
    case 'COMPONENT':
      return 'bg-teal-950/70 text-teal-300 border-teal-800/60';
    case 'TEST':
      return 'bg-yellow-950/70 text-yellow-300 border-yellow-800/60';
    case 'CONFIG':
      return 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60';
    case 'UTILITY':
      return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60';
    default:
      return 'bg-zinc-900/80 text-zinc-400 border-zinc-800';
  }
}

// Format file size utility
function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Client-side grounded topology calculation (used for instant cache and fallback if rate-limited)
function computeLocalBlastRadius(targetFile: string, dependencyGraph: Record<string, string[]> = {}): ImpactResult {
  const normalizedTarget = targetFile.replace(/\\/g, '/');
  let inDegree = 0;
  for (const [file, imports] of Object.entries(dependencyGraph)) {
    if (file === normalizedTarget) continue;
    if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === normalizedTarget)) {
      inDegree++;
    }
  }

  const visited = new Set<string>();
  let maxDepth = 0;

  function dfs(current: string, depth: number) {
    if (visited.has(current)) return;
    visited.add(current);
    maxDepth = Math.max(maxDepth, depth);

    for (const [file, imports] of Object.entries(dependencyGraph)) {
      if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === current)) {
        dfs(file.replace(/\\/g, '/'), depth + 1);
      }
    }
  }

  dfs(normalizedTarget, 0);
  visited.delete(normalizedTarget);
  const affectedFiles = Array.from(visited);
  const riskScore = 0.6 * inDegree + 0.4 * maxDepth;
  const riskLevel = riskScore >= 5.0 ? 'HIGH' : riskScore >= 2.0 ? 'MEDIUM' : 'LOW';

  const affectedRoutes: string[] = [];
  const affectedServices: string[] = [];
  const affectedControllers: string[] = [];
  const affectedComponents: string[] = [];
  const others: string[] = [];

  for (const f of affectedFiles) {
    const lower = f.toLowerCase();
    if (lower.includes('route') || lower.includes('/routes/')) affectedRoutes.push(f);
    else if (lower.includes('service') || lower.includes('/services/')) affectedServices.push(f);
    else if (lower.includes('controller') || lower.includes('/controllers/')) affectedControllers.push(f);
    else if (lower.includes('component') || lower.includes('/components/')) affectedComponents.push(f);
    else others.push(f);
  }

  const summary =
    affectedFiles.length > 0
      ? `Modifying ${normalizedTarget.split('/').pop()} propagates structural changes to ${affectedFiles.length} downstream dependent files across your project.`
      : `This file has no dependent files. Changing it is safe and will not impact other parts of the codebase.`;

  return {
    filePath: normalizedTarget,
    riskLevel,
    riskScore,
    inDegree,
    maxDepth,
    affectedFilesCount: affectedFiles.length,
    affectedFiles,
    dbModels: [],
    envVars: [],
    categories: {
      routes: affectedRoutes,
      services: affectedServices,
      controllers: affectedControllers,
      components: affectedComponents,
      others
    },
    summary
  };
}

export default function ImpactAnalysis({
  repositoryId,
  files,
  dependencyGraph,
  astMetadata = {},
  investigationTarget,
  onSelectInvestigationTarget,
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToTrace,
  onTriggerChatQuery,
  entryPoints = [],
  framework
}: ImpactAnalysisProps) {
  // 1. Target file state
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    if (investigationTarget && files.some(f => f.path === investigationTarget)) {
      return investigationTarget;
    }
    // Default to the first entry point or high-traffic file
    if (entryPoints.length > 0 && files.some(f => f.path === entryPoints[0])) {
      return entryPoints[0];
    }
    return files[0]?.path || null;
  });

  // 2. Inspected node state for detail drawer / sidebar
  const [inspectedFile, setInspectedFile] = useState<string | null>(null);

  // 3. Search & filter in target switcher
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [targetRoleFilter, setTargetRoleFilter] = useState<string>('ALL');
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  // 4. Progressive disclosure toggles
  const [showAllDirect, setShowAllDirect] = useState(false);
  const [showAllIndirect, setShowAllIndirect] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // 5. Backend analysis execution state
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Analyzing dependency graph...');
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // 6. Cache of simulation results to eliminate redundant API requests and rate limits
  const resultsCache = useRef<Record<string, ImpactResult>>({});
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Helper to switch the active target entity
  const selectTargetFile = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath);
      setInspectedFile(filePath);
      onSelectInvestigationTarget?.(filePath);
    },
    [onSelectInvestigationTarget]
  );

  // Synchronize when investigationTarget prop changes from other tabs
  useEffect(() => {
    if (investigationTarget && investigationTarget !== selectedFile) {
      setSelectedFile(investigationTarget);
      setInspectedFile(investigationTarget);
    }
  }, [investigationTarget, selectedFile]);

  // Execute blast-radius simulation whenever selectedFile changes
  useEffect(() => {
    if (!selectedFile) return;

    // 1. Check local cache first
    const cached = resultsCache.current[selectedFile];
    if (cached) {
      setResult(cached);
      setSimulationError(null);
      setAnalyzing(false);
      return;
    }

    let isMounted = true;
    setAnalyzing(true);
    setResult(null);
    setSimulationError(null);
    setShowAllDirect(false);
    setShowAllIndirect(false);
    setShowAllRoutes(false);

    const steps = [
      'Inspecting AST import declarations...',
      'Computing in-degree centrality...',
      'Evaluating transitive downstream cascade...',
      'Synthesizing architectural blast radius...'
    ];
    let stepIdx = 0;
    setLoadingStep(steps[0]);
    const interval = setInterval(() => {
      if (stepIdx < steps.length - 1) {
        stepIdx++;
        if (isMounted) setLoadingStep(steps[stepIdx]);
      }
    }, 300);

    api
      .post(`/repos/${repositoryId}/impact`, { filePath: selectedFile })
      .then(({ data }) => {
        if (!isMounted) return;
        clearInterval(interval);
        if (data && data.data) {
          resultsCache.current[selectedFile] = data.data;
          setResult(data.data);
        } else {
          throw new Error('No simulation data returned from backend');
        }
      })
      .catch((err: any) => {
        if (!isMounted) return;
        clearInterval(interval);
        // Fallback to grounded topology from dependency graph
        const fallback = computeLocalBlastRadius(selectedFile, dependencyGraph);
        resultsCache.current[selectedFile] = fallback;
        setResult(fallback);
      })
      .finally(() => {
        if (isMounted) {
          setAnalyzing(false);
        }
      });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [repositoryId, selectedFile, dependencyGraph, retryTrigger]);

  // Direct dependents computed directly from dependencyGraph ground truth
  const directDependents = useMemo(() => {
    if (!selectedFile || !dependencyGraph) return [];
    const normalizedSelected = selectedFile.replace(/\\/g, '/');
    const dependents: string[] = [];

    for (const [file, imports] of Object.entries(dependencyGraph)) {
      const normFile = file.replace(/\\/g, '/');
      if (normFile === normalizedSelected) continue;
      if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === normalizedSelected)) {
        dependents.push(normFile);
      }
    }
    return dependents;
  }, [selectedFile, dependencyGraph]);

  // Indirect dependents: affected files from backend that are not direct dependents
  const indirectDependents = useMemo(() => {
    if (!result || !result.affectedFiles) return [];
    const directSet = new Set(directDependents.map(f => f.replace(/\\/g, '/')));
    const normalizedSelected = (selectedFile || '').replace(/\\/g, '/');

    return result.affectedFiles.filter(f => {
      const norm = f.replace(/\\/g, '/');
      return norm !== normalizedSelected && !directSet.has(norm);
    });
  }, [result, directDependents, selectedFile]);

  // Causal Provenance: calculate which direct dependent acted as the bridge to an indirect file
  const getProvenanceBridge = useCallback(
    (indirectFile: string): string | null => {
      if (!dependencyGraph || directDependents.length === 0) return null;
      const normIndirect = indirectFile.replace(/\\/g, '/');

      // 1. Direct parent check: Does indirectFile import any directDependent?
      const importsOfIndirect = dependencyGraph[normIndirect] || [];
      for (const dir of directDependents) {
        const normDir = dir.replace(/\\/g, '/');
        if (importsOfIndirect.some(imp => imp.replace(/\\/g, '/') === normDir)) {
          return dir;
        }
      }

      // 2. Transitive reachability check via BFS
      for (const dir of directDependents) {
        const normDir = dir.replace(/\\/g, '/');
        const queue = [normDir];
        const visited = new Set<string>([normDir]);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          for (const [file, imports] of Object.entries(dependencyGraph)) {
            if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === curr) && !visited.has(file)) {
              if (file === normIndirect) return dir;
              visited.add(file);
              queue.push(file);
            }
          }
        }
      }
      return directDependents[0] || null;
    },
    [dependencyGraph, directDependents]
  );

  // Top Hub files (highest in-degree in repository) for fast target switching
  const topHubFiles = useMemo(() => {
    if (!dependencyGraph) return [];
    const inDegreeCounts: Record<string, number> = {};

    for (const [, imports] of Object.entries(dependencyGraph)) {
      if (Array.isArray(imports)) {
        for (const imp of imports) {
          const norm = imp.replace(/\\/g, '/');
          inDegreeCounts[norm] = (inDegreeCounts[norm] || 0) + 1;
        }
      }
    }

    return Object.entries(inDegreeCounts)
      .filter(([f, count]) => count > 0 && files.some(file => file.path.replace(/\\/g, '/') === f))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([filePath, count]) => ({ filePath, count }));
  }, [dependencyGraph, files]);

  // Filtered files for target switcher search
  const filteredTargetFiles = useMemo(() => {
    const q = targetSearchQuery.trim().toLowerCase();
    return files.filter(f => {
      const norm = f.path.replace(/\\/g, '/');
      const matchesSearch = !q || norm.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (targetRoleFilter === 'ALL') return true;
      const role = detectArchitecturalRole(norm, astMetadata?.[norm], entryPoints);
      if (targetRoleFilter === 'ENTRY' && role === 'ENTRY POINT') return true;
      if (targetRoleFilter === 'ROUTES' && role === 'ROUTE') return true;
      if (targetRoleFilter === 'CONTROLLERS' && role === 'CONTROLLER') return true;
      if (targetRoleFilter === 'SERVICES' && role === 'SERVICE') return true;
      if (targetRoleFilter === 'COMPONENTS' && role === 'COMPONENT') return true;
      return false;
    });
  }, [files, targetSearchQuery, targetRoleFilter, astMetadata, entryPoints]);

  // Active target metadata
  const targetFileItem = useMemo(() => {
    return files.find(f => f.path.replace(/\\/g, '/') === (selectedFile || '').replace(/\\/g, '/'));
  }, [files, selectedFile]);

  const targetRole = useMemo(() => {
    return detectArchitecturalRole(selectedFile, astMetadata?.[selectedFile || ''], entryPoints);
  }, [selectedFile, astMetadata, entryPoints]);

  // Inspected node metadata
  const inspectedNodeItem = useMemo(() => {
    if (!inspectedFile) return null;
    return files.find(f => f.path.replace(/\\/g, '/') === inspectedFile.replace(/\\/g, '/'));
  }, [files, inspectedFile]);

  const inspectedNodeRole = useMemo(() => {
    if (!inspectedFile) return 'MODULE';
    return detectArchitecturalRole(inspectedFile, astMetadata?.[inspectedFile], entryPoints);
  }, [inspectedFile, astMetadata, entryPoints]);

  const inspectedNodeAst = useMemo(() => {
    if (!inspectedFile || !astMetadata) return null;
    return astMetadata[inspectedFile] || null;
  }, [inspectedFile, astMetadata]);

  // Risk styling helper
  const riskMeta = useMemo(() => {
    if (!result) {
      return {
        label: 'COMPUTING',
        color: 'text-zinc-400',
        bg: 'bg-zinc-800/60',
        border: 'border-zinc-700/60',
        bar: 'bg-zinc-600',
        glow: 'rgba(161, 161, 170, 0.1)'
      };
    }
    const lvl = String(result.riskLevel || '').toUpperCase();
    if (lvl === 'CRITICAL' || lvl === 'HIGH' || result.riskScore >= 5.0) {
      return {
        label: 'HIGH BLAST RISK',
        color: 'text-rose-400',
        bg: 'bg-rose-950/40',
        border: 'border-rose-800/60',
        bar: 'bg-rose-500',
        glow: 'rgba(244, 63, 94, 0.15)'
      };
    }
    if (lvl === 'MEDIUM' || result.riskScore >= 2.0) {
      return {
        label: 'MODERATE IMPACT',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40',
        border: 'border-amber-800/60',
        bar: 'bg-amber-500',
        glow: 'rgba(245, 158, 11, 0.15)'
      };
    }
    return {
      label: 'CONTAINED IMPACT',
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40',
      border: 'border-emerald-800/60',
      bar: 'bg-emerald-500',
      glow: 'rgba(16, 185, 129, 0.15)'
    };
  }, [result]);

  // Export report
  const handleExport = (format: 'md' | 'json') => {
    if (!result || !selectedFile) return;
    let dataStr = '';
    let mimeType = 'text/plain';
    const cleanTargetName = selectedFile.split('/').pop() || 'target';

    if (format === 'json') {
      dataStr = JSON.stringify(
        {
          repositoryId,
          simulatedTarget: selectedFile,
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          inDegree: result.inDegree,
          maxDepth: result.maxDepth,
          affectedFilesCount: result.affectedFilesCount,
          directDependents,
          indirectDependents,
          affectedRoutes: result.categories.routes,
          dbModels: result.dbModels,
          envVars: result.envVars,
          summary: result.summary
        },
        null,
        2
      );
      mimeType = 'application/json';
    } else {
      dataStr = `# ARCHON IMPACT ANALYSIS & BLAST-RADIUS AUDIT REPORT

**Target Entity:** \`${selectedFile}\`  
**Architectural Role:** ${targetRole}  
**Blast Severity Index:** ${riskMeta.label} (${result.riskScore.toFixed(1)})  
**Direct Dependents (In-Degree $C_i$):** ${result.inDegree}  
**Max Cascade Depth ($d_{blast}$):** ${result.maxDepth} levels  
**Total Affected Files:** ${result.affectedFilesCount} modules  

---

## 1. Executive Summary & AI Cascade Explanation
${result.summary || 'No downstream consumers detected.'}

---

## 2. Level 1: Direct Dependents (${directDependents.length})
${
  directDependents.length > 0
    ? directDependents.map((f, i) => `${i + 1}. \`${f}\` [Direct import contract]`).join('\n')
    : '_None. This file is not directly imported by other modules._'
}

---

## 3. Level 2+: Indirect Blast Radius (${indirectDependents.length})
${
  indirectDependents.length > 0
    ? indirectDependents
        .map((f, i) => {
          const bridge = getProvenanceBridge(f);
          return `${i + 1}. \`${f}\` (Transitive via bridge: \`${bridge || 'direct dependent'}\`)`;
        })
        .join('\n')
    : '_No indirect downstream files._'
}

---

## 4. Affected External & Runtime Surfaces
- **Routes & APIs:** ${result.categories.routes.length > 0 ? result.categories.routes.join(', ') : 'None'}
- **Controllers:** ${result.categories.controllers.length > 0 ? result.categories.controllers.join(', ') : 'None'}
- **Services:** ${result.categories.services.length > 0 ? result.categories.services.join(', ') : 'None'}
- **Components:** ${result.categories.components.length > 0 ? result.categories.components.join(', ') : 'None'}
- **Database Models Referenced:** ${result.dbModels.length > 0 ? result.dbModels.join(', ') : 'None'}
- **Environment Variables Touched:** ${result.envVars.length > 0 ? result.envVars.join(', ') : 'None'}

---
*Report generated by Archon Architectural Intelligence Workbench*`;
      mimeType = 'text/markdown';
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archon_blast_radius_${cleanTargetName}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported blast-radius report (${format.toUpperCase()})`);
  };

  return (
    <div className="w-full min-h-screen text-zinc-200 pb-24 font-sans selection:bg-purple-500/30">
      
      {/* 1. STICKY TARGET WORKBENCH HEADER */}
      <header className="sticky top-0 z-30 w-full bg-[#0e0e11]/95 backdrop-blur-md border-b border-[#27272a] px-4 lg:px-6 py-3.5 shadow-xl transition-all">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Target Identifier & Selector Dropdown */}
          <div className="flex items-center gap-3 min-w-0 relative">
            <div className="p-2 bg-purple-950/40 border border-purple-800/50 rounded-lg text-purple-400 shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Target of Investigation
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {framework ? `${framework} Architecture` : 'Codebase Module'}
                </span>
              </div>

              {/* Target File Display & Switcher Button */}
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => setIsTargetDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 text-left group cursor-pointer focus:outline-none"
                  title="Click to switch simulation target"
                >
                  <h1 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight group-hover:text-purple-300 transition-colors truncate">
                    {selectedFile ? selectedFile.split('/').pop() : 'Select Target File'}
                  </h1>
                  <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">
                    <svg className={`w-4 h-4 transition-transform ${isTargetDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getRoleBadgeStyle(targetRole)}`}>
                  {targetRole}
                </span>

                {targetFileItem && (
                  <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-500">
                    {targetFileItem.lines} lines • {formatBytes(targetFileItem.size)}
                  </span>
                )}
              </div>
            </div>

            {/* Target Selection Dropdown Modal */}
            <AnimatePresence>
              {isTargetDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 w-[340px] sm:w-[480px] bg-[#131316] border border-[#27272a] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[460px]"
                >
                  {/* Search input */}
                  <div className="p-3 border-b border-[#27272a] bg-[#0e0e11]/80">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={targetSearchQuery}
                        onChange={e => setTargetSearchQuery(e.target.value)}
                        placeholder="Search file path or name..."
                        className="w-full bg-[#09090b] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                        autoFocus
                      />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
                      {['ALL', 'ROUTES', 'CONTROLLERS', 'SERVICES', 'COMPONENTS', 'ENTRY'].map(filter => (
                        <button
                          key={filter}
                          onClick={() => setTargetRoleFilter(filter)}
                          className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer ${
                            targetRoleFilter === filter
                              ? 'bg-purple-600 text-white font-semibold'
                              : 'bg-[#1e1e22] text-zinc-400 hover:text-white'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hotspot Recommendations */}
                  {topHubFiles.length > 0 && !targetSearchQuery && (
                    <div className="px-3 py-2 bg-purple-950/20 border-b border-[#27272a]">
                      <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider block mb-1.5 font-semibold">
                        Critical Centrality Hotspots (High In-Degree)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {topHubFiles.map(({ filePath, count }) => (
                          <button
                            key={filePath}
                            onClick={() => {
                              setIsTargetDropdownOpen(false);
                              selectTargetFile(filePath);
                            }}
                            className="px-2 py-0.5 bg-[#18181b] hover:bg-purple-900/40 border border-[#27272a] hover:border-purple-500/50 rounded text-[11px] font-mono text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="truncate max-w-[140px]">{filePath.split('/').pop()}</span>
                            <span className="text-[9px] bg-purple-900/60 text-purple-300 px-1 rounded">
                              {count} dep
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filtered list */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredTargetFiles.length > 0 ? (
                      filteredTargetFiles.map(f => {
                        const isCurrent = f.path === selectedFile;
                        const role = detectArchitecturalRole(f.path, astMetadata?.[f.path], entryPoints);
                        return (
                          <div
                            key={f.path}
                            onClick={() => {
                              setIsTargetDropdownOpen(false);
                              selectTargetFile(f.path);
                            }}
                            className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between text-xs font-mono group ${
                              isCurrent
                                ? 'bg-purple-950/40 border border-purple-500/40 text-purple-200'
                                : 'hover:bg-[#1a1a1e] text-zinc-300'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white group-hover:text-purple-300 transition-colors truncate">
                                  {f.path.split('/').pop()}
                                </span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] border ${getRoleBadgeStyle(role)}`}>
                                  {role}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-500 block truncate mt-0.5">{f.path}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 shrink-0">{f.lines}L</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-zinc-500 font-mono text-xs">
                        No matching files found in repository.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Action Buttons (Export, Resimulate, Ask AI) */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedFile && (
              <>
                <button
                  onClick={() =>
                    onTriggerChatQuery(
                      `Perform a thorough architectural impact analysis for modifying "${selectedFile}". How should we manage testing and downstream breakage?`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-medium transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] flex items-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <span>Ask Archon AI</span>
                </button>

                <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-lg p-0.5">
                  <button
                    onClick={() => handleExport('md')}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#27272a] rounded cursor-pointer transition-colors"
                    title="Export Markdown Report"
                  >
                    <span className="text-[10px] font-mono font-semibold px-1">MD</span>
                  </button>
                  <div className="w-[1px] h-3.5 bg-[#27272a]" />
                  <button
                    onClick={() => handleExport('json')}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#27272a] rounded cursor-pointer transition-colors"
                    title="Export JSON Payload"
                  >
                    <span className="text-[10px] font-mono font-semibold px-1">JSON</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKBENCH CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 lg:px-6 pt-6 space-y-6">
        
        {/* Loading Overlay */}
        {analyzing && (
          <div className="bg-[#131316]/90 border border-purple-500/30 rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center shadow-2xl backdrop-blur-md">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />
              <div className="w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-semibold text-white tracking-wide uppercase">
                Simulating Blast Radius
              </h3>
              <p className="text-xs font-mono text-purple-300/80 mt-1">{loadingStep}</p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {!analyzing && simulationError && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-5 flex items-start gap-4 shadow-lg">
            <div className="p-2 bg-rose-900/60 text-rose-300 rounded-lg shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-rose-200">Simulation Encountered an Issue</h4>
              <p className="text-xs text-rose-300/80 mt-0.5">{simulationError}</p>
              <button
                onClick={() => setRetryTrigger(c => c + 1)}
                className="mt-3 px-3 py-1 bg-rose-900/50 hover:bg-rose-800/50 text-rose-200 rounded text-xs font-mono cursor-pointer transition-colors border border-rose-700/50"
              >
                Retry Analysis
              </button>
            </div>
          </div>
        )}

        {/* 3. GROUNDED SUMMARY & BLAST RADIUS METRICS STRIP */}
        {!analyzing && result && (
          <div className="space-y-4">
            
            {/* Blast Radius High-Level Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              
              {/* Severity / Risk Level */}
              <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${riskMeta.bg} ${riskMeta.border} shadow-lg relative overflow-hidden`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                    Blast Severity
                  </span>
                  <span className={`w-2 h-2 rounded-full ${riskMeta.bar}`} />
                </div>
                <div className="mt-2">
                  <span className={`text-base sm:text-lg font-bold font-mono tracking-tight block ${riskMeta.color}`}>
                    {riskMeta.label}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
                    Score: {result.riskScore.toFixed(1)} / 10
                  </span>
                </div>
              </div>

              {/* Direct Dependents (Level 1 In-degree) */}
              <div className="p-3.5 rounded-xl border border-[#27272a] bg-[#131316] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Direct Dependents
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                    {result.inDegree}
                  </span>
                  <span className="text-[11px] font-mono text-purple-400 mt-0.5 block">
                    Level 1 consumers (In-Degree)
                  </span>
                </div>
              </div>

              {/* Max Cascade Depth */}
              <div className="p-3.5 rounded-xl border border-[#27272a] bg-[#131316] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Cascade Depth
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                    {result.maxDepth}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 mt-0.5 block">
                    Downstream cascade hops
                  </span>
                </div>
              </div>

              {/* Total Blast Radius (All Reachable Files) */}
              <div className="p-3.5 rounded-xl border border-[#27272a] bg-[#131316] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Total Blast Radius
                </span>
                <div className="mt-2">
                  <span className={`text-xl sm:text-2xl font-bold font-mono block ${result.affectedFilesCount > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                    {result.affectedFilesCount}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 mt-0.5 block">
                    Downstream modules
                  </span>
                </div>
              </div>

              {/* Exposed Routes / Surfaces */}
              <div className="p-3.5 rounded-xl border border-[#27272a] bg-[#131316] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Affected Routes
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-blue-400 block">
                    {result.categories.routes.length}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 mt-0.5 block">
                    API ingress surfaces
                  </span>
                </div>
              </div>

              {/* Database & Env Touchpoints */}
              <div className="p-3.5 rounded-xl border border-[#27272a] bg-[#131316] flex flex-col justify-between shadow-lg">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Data Touchpoints
                </span>
                <div className="mt-2">
                  <span className="text-sm font-bold font-mono text-zinc-200 block">
                    {result.dbModels.length} DB / {result.envVars.length} Env
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 mt-0.5 block truncate">
                    {result.dbModels.length > 0 ? result.dbModels.slice(0, 2).join(', ') : 'No direct schema'}
                  </span>
                </div>
              </div>

            </div>

            {/* AI Architectural Summary Narrative */}
            {result.summary && (
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 shadow-md flex items-start gap-3.5">
                <div className="p-2 bg-purple-900/50 text-purple-300 rounded-lg shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-semibold">
                      Architectural Impact Insight
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Grounded in AST imports and dependency graph
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 font-normal leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. MAIN WORKBENCH SPLIT: BLAST RADIUS TREE + INVESTIGATION INSPECTOR */}
        {!analyzing && result && selectedFile && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT 8 COLS: BLAST RADIUS HIERARCHY TREE */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* SECTION: LEVEL 0 - THE TARGET ROOT */}
              <div className="bg-[#131316] border border-[#27272a] rounded-xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                        LEVEL 0: TARGET ROOT
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getRoleBadgeStyle(targetRole)}`}>
                        {targetRole}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold font-mono text-white mt-1.5">
                      {selectedFile.split('/').pop()}
                    </h2>
                    <p className="text-xs font-mono text-zinc-400 mt-0.5 break-all">
                      {selectedFile}
                    </p>
                  </div>

                  <button
                    onClick={() => setInspectedFile(selectedFile)}
                    className="self-start sm:self-center px-3 py-1.5 bg-[#1e1e22] hover:bg-[#27272a] border border-[#34343a] text-xs font-mono text-zinc-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Inspect Origin Details →
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-[#27272a] flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Imports Outbound:</span>
                    <span className="text-zinc-200 font-semibold">
                      {dependencyGraph?.[selectedFile.replace(/\\/g, '/')]?.length || 0} files
                    </span>
                  </div>
                  <div className="text-zinc-600">•</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">Direct Inbound Dependents:</span>
                    <span className="text-purple-300 font-semibold">{directDependents.length} files</span>
                  </div>
                  {targetFileItem && (
                    <>
                      <div className="text-zinc-600">•</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Size:</span>
                        <span className="text-zinc-200">{formatBytes(targetFileItem.size)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* VERTICAL CONNECTOR SPINE TO LEVEL 1 */}
              <div className="flex justify-center -my-2">
                <div className="w-0.5 h-6 bg-gradient-to-b from-purple-500 to-blue-500" />
              </div>

              {/* SECTION: LEVEL 1 - DIRECT DEPENDENTS */}
              <div className="bg-[#131316] border border-[#27272a] rounded-xl p-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/40">
                        LEVEL 1: DIRECT IMPACT ({directDependents.length})
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400">
                        Files with explicit <code className="text-blue-300 bg-blue-950/40 px-1 py-0.5 rounded">import</code> contracts to target
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Direct dependents will directly experience interface breaking changes, missing exports, or signature alterations.
                    </p>
                  </div>

                  {directDependents.length > 6 && (
                    <button
                      onClick={() => setShowAllDirect(prev => !prev)}
                      className="text-xs font-mono text-blue-400 hover:text-blue-300 underline cursor-pointer shrink-0"
                    >
                      {showAllDirect ? 'Show fewer' : `Show all ${directDependents.length}`}
                    </button>
                  )}
                </div>

                {directDependents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(showAllDirect ? directDependents : directDependents.slice(0, 6)).map(dep => {
                      const role = detectArchitecturalRole(dep, astMetadata?.[dep], entryPoints);
                      const isInspected = inspectedFile === dep;
                      const subCascade = (result.affectedFiles || []).filter(
                        af => af !== dep && dependencyGraph?.[af]?.includes(dep)
                      ).length;

                      return (
                        <div
                          key={dep}
                          onClick={() => setInspectedFile(dep)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group ${
                            isInspected
                              ? 'bg-blue-950/30 border-blue-500/70 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                              : 'bg-[#18181b]/70 border-[#27272a] hover:border-blue-500/40 hover:bg-[#1f1f23]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-xs text-white group-hover:text-blue-300 transition-colors truncate">
                                {dep.split('/').pop()}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${getRoleBadgeStyle(role)} shrink-0`}>
                                {role}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 block truncate mt-1">
                              {dep}
                            </span>
                          </div>

                          <div className="mt-3 pt-2 border-t border-[#27272a]/60 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                            <span className="text-blue-300/80">Direct consumer</span>
                            {subCascade > 0 && (
                              <span className="text-zinc-500">Cascades to {subCascade} files</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-[#27272a] rounded-lg text-zinc-500 font-mono text-xs">
                    No direct consumers found. This file is not directly imported by any other file.
                  </div>
                )}
              </div>

              {/* VERTICAL CONNECTOR SPINE TO LEVEL 2 */}
              {indirectDependents.length > 0 && (
                <div className="flex justify-center -my-2">
                  <div className="w-0.5 h-6 bg-gradient-to-b from-blue-500 to-amber-500/80" />
                </div>
              )}

              {/* SECTION: LEVEL 2+ - INDIRECT TRANSITIVE BLAST RADIUS */}
              {indirectDependents.length > 0 && (
                <div className="bg-[#131316] border border-[#27272a] rounded-xl p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500/80" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                          LEVEL 2+: INDIRECT BLAST RADIUS ({indirectDependents.length})
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          Transitive downstream consumers
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        These modules do not directly import the target, but depend on intermediate direct bridges.
                      </p>
                    </div>

                    {indirectDependents.length > 8 && (
                      <button
                        onClick={() => setShowAllIndirect(prev => !prev)}
                        className="text-xs font-mono text-amber-400 hover:text-amber-300 underline cursor-pointer shrink-0"
                      >
                        {showAllIndirect ? 'Show fewer' : `Show all ${indirectDependents.length}`}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(showAllIndirect ? indirectDependents : indirectDependents.slice(0, 8)).map(ind => {
                      const role = detectArchitecturalRole(ind, astMetadata?.[ind], entryPoints);
                      const isInspected = inspectedFile === ind;
                      const bridge = getProvenanceBridge(ind);

                      return (
                        <div
                          key={ind}
                          onClick={() => setInspectedFile(ind)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group ${
                            isInspected
                              ? 'bg-amber-950/30 border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                              : 'bg-[#18181b]/70 border-[#27272a] hover:border-amber-500/40 hover:bg-[#1f1f23]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-semibold text-xs text-white group-hover:text-amber-300 transition-colors truncate">
                                {ind.split('/').pop()}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${getRoleBadgeStyle(role)} shrink-0`}>
                                {role}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 block truncate mt-1">
                              {ind}
                            </span>
                          </div>

                          <div className="mt-3 pt-2 border-t border-[#27272a]/60 flex items-center justify-between text-[10px] font-mono">
                            <span className="text-zinc-500">Transitive bridge:</span>
                            <span className="text-amber-300/80 truncate max-w-[130px]" title={bridge || 'Intermediate'}>
                              {bridge ? bridge.split('/').pop() : 'Direct bridge'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION: AFFECTED EXECUTION SURFACES (ROUTES & API INGRESS) */}
              {result.categories.routes.length > 0 && (
                <div className="bg-[#131316] border border-[#27272a] rounded-xl p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-500" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                          AFFECTED API & INGRESS SURFACES ({result.categories.routes.length})
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          External routes reaching this target
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        Changes to the target can propagate outward to these exposed HTTP or execution entry points.
                      </p>
                    </div>

                    {result.categories.routes.length > 4 && (
                      <button
                        onClick={() => setShowAllRoutes(prev => !prev)}
                        className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer shrink-0"
                      >
                        {showAllRoutes ? 'Show fewer' : `Show all ${result.categories.routes.length}`}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(showAllRoutes ? result.categories.routes : result.categories.routes.slice(0, 4)).map(route => {
                      const isInspected = inspectedFile === route;
                      return (
                        <div
                          key={route}
                          onClick={() => setInspectedFile(route)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs font-mono group ${
                            isInspected
                              ? 'bg-cyan-950/30 border-cyan-500/70'
                              : 'bg-[#18181b]/70 border-[#27272a] hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold text-white group-hover:text-cyan-300 block truncate">
                              {route.split('/').pop()}
                            </span>
                            <span className="text-[10px] text-zinc-500 block truncate mt-0.5">{route}</span>
                          </div>
                          <span className="text-[10px] text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/50 shrink-0">
                            ROUTE
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* REASSURING ISOLATED MODULE STATE */}
              {result.affectedFilesCount === 0 && (
                <div className="bg-[#131316] border border-emerald-800/40 rounded-xl p-8 text-center space-y-3 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-950/50 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mx-auto">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-mono font-bold text-white">
                    Isolated Module — Zero Downstream Blast Radius
                  </h3>
                  <p className="text-xs font-mono text-zinc-400 max-w-md mx-auto leading-relaxed">
                    This file is not imported by other modules in the codebase. Modifying its internal implementation or exports is safe and will not cascade to downstream consumers.
                  </p>
                </div>
              )}

            </div>

            {/* RIGHT 4 COLS: STICKY NODE INVESTIGATION INSPECTOR */}
            <div className="lg:col-span-4 sticky top-24 space-y-5">
              <div className="bg-[#131316] border border-[#27272a] rounded-xl p-5 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-[#27272a]">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    Affected Node Inspector
                  </span>
                  {inspectedFile && (
                    <span className="text-[10px] font-mono text-zinc-500">
                      Active Investigation
                    </span>
                  )}
                </div>

                {inspectedFile ? (
                  <div className="mt-4 space-y-4">
                    
                    {/* Node Identification */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getRoleBadgeStyle(inspectedNodeRole)}`}>
                          {inspectedNodeRole}
                        </span>
                        {inspectedFile === selectedFile ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40">
                            SIMULATION TARGET
                          </span>
                        ) : directDependents.includes(inspectedFile) ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/60 text-blue-300 border border-blue-800/40">
                            DIRECT CONSUMER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40">
                            INDIRECT CONSUMER
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold font-mono text-white mt-2 break-all">
                        {inspectedFile.split('/').pop()}
                      </h3>
                      <p className="text-[11px] font-mono text-zinc-500 break-all mt-0.5">
                        {inspectedFile}
                      </p>
                    </div>

                    {/* Grounded Provenance: Why is this affected? */}
                    <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-lg space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                        Why is this in the blast radius?
                      </span>
                      <p className="text-xs text-zinc-300 font-normal leading-relaxed">
                        {inspectedFile === selectedFile ? (
                          'This is the root target file undergoing modification. Any changes to its exports or behavior initiate the downstream cascade.'
                        ) : directDependents.includes(inspectedFile) ? (
                          <>
                            Directly imports <code className="text-purple-300 font-mono">{selectedFile.split('/').pop()}</code>. Modifying exported types, functions, or schemas can cause compile errors or runtime divergence here.
                          </>
                        ) : (
                          <>
                            Transitively impacted through intermediate bridge{' '}
                            <code className="text-amber-300 font-mono">
                              {getProvenanceBridge(inspectedFile)?.split('/').pop() || 'upstream dependent'}
                            </code>
                            . Modifying the target propagates through the dependency pipeline into this file.
                          </>
                        )}
                      </p>
                    </div>

                    {/* File Metrics & Dependency Centrality */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-lg">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase block">Outbound Imports</span>
                        <span className="text-sm font-bold font-mono text-zinc-200 mt-0.5 block">
                          {dependencyGraph?.[inspectedFile]?.length || 0} files
                        </span>
                      </div>
                      <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded-lg">
                        <span className="text-[9px] font-mono text-zinc-500 uppercase block">File Scale</span>
                        <span className="text-sm font-bold font-mono text-zinc-200 mt-0.5 block">
                          {inspectedNodeItem ? `${inspectedNodeItem.lines} lines` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* AST Grounded Evidence (Functions & Exports) */}
                    {inspectedNodeAst && (
                      <div className="space-y-2 pt-2 border-t border-[#27272a]">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                          AST Evidence in File
                        </span>
                        
                        {/* Functions */}
                        {Array.isArray(inspectedNodeAst.functions) && inspectedNodeAst.functions.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-zinc-500 block">Functions:</span>
                            <div className="flex flex-wrap gap-1">
                              {inspectedNodeAst.functions.slice(0, 4).map((fn: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono bg-[#1e1e22] text-zinc-300 px-1.5 py-0.5 rounded border border-[#2c2c30]"
                                >
                                  {typeof fn === 'string' ? fn : fn?.name || 'anonymous'}()
                                </span>
                              ))}
                              {inspectedNodeAst.functions.length > 4 && (
                                <span className="text-[9px] font-mono text-zinc-500 self-center">
                                  +{inspectedNodeAst.functions.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Exports */}
                        {Array.isArray(inspectedNodeAst.exports) && inspectedNodeAst.exports.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-zinc-500 block">Exports:</span>
                            <div className="flex flex-wrap gap-1">
                              {inspectedNodeAst.exports.slice(0, 4).map((exp: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] font-mono bg-purple-950/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/40"
                                >
                                  {typeof exp === 'string' ? exp : exp?.name || 'export'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cross-Workspace Navigation Actions */}
                    <div className="pt-3 border-t border-[#27272a] space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold block">
                        Cross-Workspace Investigation
                      </span>

                      {/* 1. Simulate as target */}
                      {inspectedFile !== selectedFile && (
                        <button
                          onClick={() => selectTargetFile(inspectedFile)}
                          className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-mono font-medium transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Simulate This File as Target</span>
                          <span>⚡</span>
                        </button>
                      )}

                      {/* 2. Inspect in Explorer */}
                      <button
                        onClick={() => {
                          onSelectInvestigationTarget?.(inspectedFile);
                          onNavigateToExplorer(inspectedFile);
                        }}
                        className="w-full py-1.5 px-3 bg-[#18181b] hover:bg-[#222226] border border-[#27272a] hover:border-zinc-500 text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>Inspect in Code Explorer</span>
                        <span>→</span>
                      </button>

                      {/* 3. View in Architecture Graph */}
                      {onNavigateToGraph && (
                        <button
                          onClick={() => {
                            onSelectInvestigationTarget?.(inspectedFile);
                            onNavigateToGraph(inspectedFile);
                          }}
                          className="w-full py-1.5 px-3 bg-[#18181b] hover:bg-[#222226] border border-[#27272a] hover:border-zinc-500 text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>View in Architecture Graph</span>
                          <span>→</span>
                        </button>
                      )}

                      {/* 4. Trace Execution Flow */}
                      {onNavigateToTrace && (
                        <button
                          onClick={() => {
                            onSelectInvestigationTarget?.(inspectedFile);
                            onNavigateToTrace(inspectedFile);
                          }}
                          className="w-full py-1.5 px-3 bg-[#18181b] hover:bg-[#222226] border border-[#27272a] hover:border-zinc-500 text-zinc-300 hover:text-white rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Trace Execution Flow</span>
                          <span>→</span>
                        </button>
                      )}

                      {/* 5. Ask Archon AI about this specific node */}
                      <button
                        onClick={() =>
                          onTriggerChatQuery(
                            `In our impact analysis of "${selectedFile}", we found that "${inspectedFile}" is affected. What contracts or functions are most at risk of breaking?`
                          )
                        }
                        className="w-full py-1.5 px-3 bg-[#1e1e24] hover:bg-purple-950/40 border border-purple-900/40 hover:border-purple-500 text-purple-300 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span>Ask AI About This Affected File</span>
                        <span>✦</span>
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                    Click any node in the blast-radius tree to inspect its causal provenance, AST evidence, and cross-workspace investigation actions.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </main>

    </div>
  );
}
