import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import api from '../../lib/api';
import { detectArchitecturalRole } from './explorer/explorerUtils';
import { FileItem } from './explorer/explorerTypes';
import { getDependencies, getDownstream, getUpstream } from './graph/graphQueries';

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
    const normFile = file.replace(/\\/g, '/');
    if (normFile === normalizedTarget) continue;
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
      const normFile = file.replace(/\\/g, '/');
      if (normFile === current) continue;
      if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === current)) {
        dfs(normFile, depth + 1);
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

/**
 * The band scale for the risk gauge. The formula is fixed and public:
 * risk = 0.6 × in-degree + 0.4 × cascade depth. The band names, thresholds,
 * and the 10-point ceiling all come from that formula, not from a lookup table.
 */
const RISK_CEILING = 10;

function riskBand(score: number): { label: string; mod: 'high' | 'med' | 'low' } {
  if (score >= 5.0) return { label: 'High blast risk', mod: 'high' };
  if (score >= 2.0) return { label: 'Moderate impact', mod: 'med' };
  return { label: 'Contained impact', mod: 'low' };
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
  const inspectorRef = useRef<HTMLDivElement>(null);
  const [isInspectorPulsing, setIsInspectorPulsing] = useState(false);

  // Helper to focus, inspect, and smoothly highlight any node in the inspector.
  // The ref is only ever read here, inside an event handler — never during
  // render — which is why the two `react-hooks/refs` sites below are disabled.
  const handleInspectNode = useCallback((filePath: string) => {
    setInspectedFile(filePath);
    setIsInspectorPulsing(true);
    setTimeout(() => setIsInspectorPulsing(false), 1500);

    if (inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

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

        /*
         * The backend could not be reached, so the panel falls back to a local
         * computation over the dependency graph that the page already holds.
         *
         * This fallback is real and useful, but it is NOT the same answer the
         * server gives. It cannot: it has no AST metadata, so `dbModels` and
         * `envVars` come back empty, and its summary is a different sentence.
         * Presenting it unlabelled would show the user a complete-looking
         * blast radius that silently differs from the authoritative one.
         *
         * So the result is still shown — refusing to render anything would be
         * its own kind of failure — but the reason is surfaced alongside it,
         * and the caller must label it. `simulationError` carries that reason.
         */
        const fallback = computeLocalBlastRadius(selectedFile, dependencyGraph);
        resultsCache.current[selectedFile] = fallback;
        setResult(fallback);
        setSimulationError(
          'The architecture service did not respond, so this blast radius was computed locally from the dependency graph. ' +
            'Direct and transitive dependents are reliable; database models and environment variables are unavailable offline. ' +
            'Retry to load the full analysis.',
        );
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

  /* Hop distribution across the affected set.
   *
   * Every affected file is at some hop distance *upstream* of the target: 1 hop
   * is a file that imports the target directly, 2 hops is a file that imports
   * one of those, and so on. This is the reverse direction from `getDownstream`
   * — dependents, not dependencies — which is what "what breaks if I edit this"
   * means. Using the downstream traversal here would have produced a plausible
   * chart of the wrong files.
   *
   * The backend returns the affected files and the maximum depth but not the
   * per-hop split, so it is derived from the same dependency graph the rest of
   * the tab uses, via the shared traversal rather than a second hand-rolled BFS.
   *
   * Only files the backend actually reported as affected are counted, so the
   * chart can never show more than the total the API returned. If the traversal
   * cannot place a file, it is left out of the bars rather than guessed at — and
   * the remainder is stated.
   */
  const hopDistribution = useMemo(() => {
    if (!result || !dependencyGraph || !selectedFile) return null;

    const normalizedSelected = selectedFile.replace(/\\/g, '/');
    const affected = new Set((result.affectedFiles || []).map((f) => f.replace(/\\/g, '/')));

    const byHop = new Map<number, number>();
    let placed = 0;

    // Bounded by the backend's own depth, so this cannot run away.
    const reached = getUpstream(dependencyGraph, normalizedSelected, Math.max(1, result.maxDepth || 1));
    for (const { path: p, hops } of reached) {
      if (!affected.has(p)) continue;
      byHop.set(hops, (byHop.get(hops) ?? 0) + 1);
      placed++;
    }

    const maxHop = Math.max(0, ...byHop.keys());
    if (maxHop === 0) return null;

    const bars = Array.from({ length: maxHop }, (_, i) => {
      const hop = i + 1;
      return { hop, count: byHop.get(hop) ?? 0 };
    });
    const peak = Math.max(1, ...bars.map((b) => b.count));

    return {
      bars,
      peak,
      placed,
      total: affected.size,
      maxHop,
    };
  }, [result, dependencyGraph, selectedFile]);

  // Causal provenance: which direct dependent is the bridge to an indirect file.
  //
  // Two checks, cheapest first. A file imported *directly* by the indirect file
  // is the bridge — that is one lookup. Otherwise the indirect file is reached
  // transitively, and we ask the shared traversal rather than scanning every
  // file for every node in the queue (which was O(files × edges) and would not
  // scale past a few hundred files).
  const getProvenanceBridge = useCallback(
    (indirectFile: string): string | null => {
      if (!dependencyGraph || directDependents.length === 0) return null
      const norm = (s: string) => s.replace(/\\/g, '/')
      const normIndirect = norm(indirectFile)

      const directByNormalised = new Map(directDependents.map((d) => [norm(d), d]))

      // 1. direct: does the indirect file import one of the direct dependents?
      for (const imported of getDependencies(dependencyGraph, normIndirect)) {
        const match = directByNormalised.get(norm(imported))
        if (match) return match
      }

      // 2. transitive: does the indirect file sit downstream of a direct dependent?
      for (const dependent of directDependents) {
        const reached = getDownstream(dependencyGraph, norm(dependent))
        if (reached.some((r) => norm(r.path) === normIndirect)) return dependent
      }

      // No verified bridge. Returning null is the honest answer — the caller
      // says "no path found" rather than naming an arbitrary dependent.
      return null
    },
    [dependencyGraph, directDependents],
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

  // Export report
  const handleExport = (format: 'md' | 'json') => {
    if (!result || !selectedFile) return;
    let dataStr: string;
    let mimeType: string;
    const cleanTargetName = selectedFile.split('/').pop() || 'target';
    const band = riskBand(result.riskScore);

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
**Blast Severity Index:** ${band.label} (${result.riskScore.toFixed(1)})  
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

  const band = result ? riskBand(result.riskScore) : null;
  const riskPct = result ? Math.min(100, (result.riskScore / RISK_CEILING) * 100) : 0;

  return (
    <div className="w-full">
      {/* ── header ────────────────────────────────────────────────────── */}
      <div className="khead">
        <div className="khead__l">
          <div className="eyebrow">Impact analysis</div>
          <h1 className="khead__t">
            What <em className="serif-it">breaks</em> if this file changes.
          </h1>
          <p className="khead__d">
            The blast radius is resolved from import contracts, then scored. Pick a target to
            trace its direct consumers and the transitive cascade behind them.
          </p>
        </div>
        <div className="khead__r">
          {framework && (
            <span className="st st--idle">
              <i />
              {framework}
            </span>
          )}
          {selectedFile && (
            <>
              <button
                type="button"
                onClick={() =>
                  onTriggerChatQuery(
                    `Perform a thorough architectural impact analysis for modifying "${selectedFile}". How should we manage testing and downstream breakage?`
                  )
                }
                className="abtn abtn--solid"
              >
                Ask Archon
              </button>
              <button type="button" onClick={() => handleExport('md')} className="abtn abtn--ghost">
                MD
              </button>
              <button type="button" onClick={() => handleExport('json')} className="abtn abtn--ghost">
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── target selector ───────────────────────────────────────────── */}
      <div className="isel mb-6">
        <div className="isel__head flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="figcap">Target of investigation</span>
            {selectedFile && (
              <span className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-2">
                {targetRole}
              </span>
            )}
            {targetFileItem && (
              <span className="font-mono text-[9.5px] text-ink-3">
                {targetFileItem.lines} lines · {formatBytes(targetFileItem.size)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsTargetDropdownOpen(prev => !prev)}
            aria-expanded={isTargetDropdownOpen}
            className="abtn abtn--ghost !py-1.5 !text-[10px]"
            title="Switch simulation target"
          >
            Switch target
            <svg
              className={`h-3 w-3 transition-transform ${isTargetDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="isel__body">
          <div className="isel__file">
            <span className="ic">
              {(selectedFile?.split('.').pop() || '??').slice(0, 3).toUpperCase()}
            </span>
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              {selectedFile || 'No target selected'}
            </span>
          </div>

          <AnimatePresence>
            {isTargetDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="mb-4 flex max-h-[440px] flex-col overflow-hidden rounded-[3px] border border-rule bg-paper-2"
              >
                {/* search */}
                <div className="border-b border-rule bg-paper-3 p-3">
                  <div className="flex items-center gap-2 rounded-[3px] border border-rule-strong bg-paper-2 px-3 py-1.5">
                    <svg className="h-3.5 w-3.5 shrink-0 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                      type="text"
                      value={targetSearchQuery}
                      onChange={e => setTargetSearchQuery(e.target.value)}
                      placeholder="Search file path or name…"
                      className="w-full border-none bg-transparent p-0 font-mono text-[11px] text-ink outline-none placeholder:text-ink-3 focus:ring-0"
                      autoFocus
                    />
                  </div>

                  <div className="mt-2.5 flex items-center gap-0.5 overflow-x-auto rounded-[3px] border border-rule bg-paper-2 p-0.5">
                    {['ALL', 'ROUTES', 'CONTROLLERS', 'SERVICES', 'COMPONENTS', 'ENTRY'].map(filter => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setTargetRoleFilter(filter)}
                        className={`whitespace-nowrap rounded-[2px] px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.09em] transition-colors ${
                          targetRoleFilter === filter
                            ? 'bg-paper-3 font-semibold text-ink shadow-[inset_0_-2px_0_var(--emerald)]'
                            : 'text-ink-3 hover:text-ink'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                {/* hotspots */}
                {topHubFiles.length > 0 && !targetSearchQuery && (
                  <div className="border-b border-rule bg-paper-3 px-3 py-2.5">
                    <span className="figcap mb-1.5 block">Critical centrality hotspots — highest in-degree</span>
                    <div className="flex flex-wrap gap-1.5">
                      {topHubFiles.map(({ filePath, count }) => (
                        <button
                          key={filePath}
                          type="button"
                          onClick={() => {
                            setIsTargetDropdownOpen(false);
                            selectTargetFile(filePath);
                          }}
                          className="flex items-center gap-1.5 rounded-[2px] border border-rule bg-paper-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
                        >
                          <span className="max-w-[140px] truncate">{filePath.split('/').pop()}</span>
                          <span className="text-[9px] text-emerald">{count} dep</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* list */}
                <div className="flex-1 overflow-y-auto p-2">
                  {filteredTargetFiles.length > 0 ? (
                    filteredTargetFiles.map(f => {
                      const isCurrent = f.path === selectedFile;
                      const role = detectArchitecturalRole(f.path, astMetadata?.[f.path], entryPoints);
                      return (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => {
                            setIsTargetDropdownOpen(false);
                            selectTargetFile(f.path);
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left font-mono transition-colors ${
                            isCurrent ? 'bg-paper-3' : 'hover:bg-paper-3'
                          }`}
                        >
                          <span className="min-w-0 pr-2">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[11.5px] font-semibold text-ink">
                                {f.path.split('/').pop()}
                              </span>
                              <span className="shrink-0 rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 text-[8.5px] uppercase text-ink-3">
                                {role}
                              </span>
                            </span>
                            <span className="mt-0.5 block truncate text-[9.5px] text-ink-3">{f.path}</span>
                          </span>
                          <span className="shrink-0 text-[9.5px] text-ink-3">{f.lines}L</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center font-mono text-[11px] text-ink-3">
                      No matching files found in repository.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── loading ───────────────────────────────────────────────────── */}
      {analyzing && (
        <div className="panel mb-6">
          <div className="panel__body flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full border-2 border-emerald/20" />
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald border-t-transparent" />
            </div>
            <div>
              <div className="figcap">Simulating blast radius</div>
              <p className="mt-1 font-mono text-[11px] text-ink-2">{loadingStep}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── degraded / failed ─────────────────────────────────────────── */}
      {!analyzing && simulationError && (
        <div className="panel mb-6 !border-amber">
          <div className="panel__body flex items-start gap-3">
            <span className="st st--warn mt-0.5">
              <i />
              {result ? 'Degraded' : 'Failed'}
            </span>
            <div className="flex-1">
              <p className="text-[12.5px] leading-[1.6] text-ink-2">{simulationError}</p>
              <button
                type="button"
                onClick={() => setRetryTrigger(c => c + 1)}
                className="abtn abtn--ghost mt-3 !py-1.5 !text-[10px]"
              >
                Retry analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── results ───────────────────────────────────────────────────── */}
      {!analyzing && result && selectedFile && (
        <>
          <div className="impact-grid mb-6">
            {/* left — the risk instrument */}
            <div className="panel">
              <div className="panel__head">
                <div className="t">Blast severity index</div>
                <div className="r">risk = 0.6·in-degree + 0.4·depth</div>
              </div>
              <div className="panel__body">
                <div className="riskgauge">
                  <div className="rg__top">
                    <span className="rg__num">
                      {result.riskScore.toFixed(1)}
                      <small>/ {RISK_CEILING}</small>
                    </span>
                    {band && <span className={`rg__band rg__band--${band.mod}`}>{band.label}</span>}
                  </div>

                  <div className="rg__scale">
                    <div className="rg__track">
                      <div className="rg__fill" style={{ width: `${riskPct}%` }} />
                    </div>
                    <div className="rg__marks">
                      <span>0</span>
                      <span>2 · moderate</span>
                      <span>5 · high</span>
                      <span>{RISK_CEILING}</span>
                    </div>
                  </div>

                  <div className="rg__formula">
                    (<b>0.6</b> × in-degree <u>{result.inDegree}</u>) + (<b>0.4</b> × cascade depth{' '}
                    <u>{result.maxDepth}</u>) = <b>{result.riskScore.toFixed(1)}</b>
                  </div>
                </div>
              </div>
            </div>

            {/* right — category counts */}
            <div className="panel">
              <div className="panel__head">
                <div className="t">Reached surfaces</div>
              </div>
              <div className="panel__body">
                <div className="catbar">
                  <div className={`catcell ${result.categories.routes.length > 0 ? 'catcell--hit' : 'catcell--none'}`}>
                    <div className="k">Routes</div>
                    <div className="v">{result.categories.routes.length}</div>
                    <div className="u">API ingress</div>
                  </div>
                  <div className={`catcell ${result.categories.controllers.length > 0 ? 'catcell--hit' : 'catcell--none'}`}>
                    <div className="k">Controllers</div>
                    <div className="v">{result.categories.controllers.length}</div>
                    <div className="u">handlers</div>
                  </div>
                  <div className={`catcell ${result.categories.services.length > 0 ? 'catcell--hit' : 'catcell--none'}`}>
                    <div className="k">Services</div>
                    <div className="v">{result.categories.services.length}</div>
                    <div className="u">domain logic</div>
                  </div>
                  <div className={`catcell ${result.categories.components.length > 0 ? 'catcell--hit' : 'catcell--none'}`}>
                    <div className="k">Components</div>
                    <div className="v">{result.categories.components.length}</div>
                    <div className="u">UI units</div>
                  </div>
                  <div className={`catcell ${result.categories.others.length > 0 ? 'catcell--hit' : 'catcell--none'}`}>
                    <div className="k">Other</div>
                    <div className="v">{result.categories.others.length}</div>
                    <div className="u">modules</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-4">
                  <div className="ikv">
                    <span className="k">Direct dependents</span>
                    <span className="v">{result.inDegree}</span>
                  </div>
                  <div className="ikv">
                    <span className="k">Cascade depth</span>
                    <span className="v">{result.maxDepth}</span>
                  </div>
                  <div className="ikv">
                    <span className="k">Affected files</span>
                    <span className={result.affectedFilesCount > 0 ? 'v v--risk' : 'v v--em'}>
                      {result.affectedFilesCount}
                    </span>
                  </div>
                  <div className="ikv">
                    <span className="k">DB / env touchpoints</span>
                    <span className="v">
                      {result.dbModels.length} / {result.envVars.length}
                    </span>
                  </div>
                </div>

                {result.summary && (
                  <p className="mt-4 border-t border-rule pt-3 text-[12.5px] leading-[1.65] text-ink-2">
                    {result.summary}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── hop distribution across the affected set ───────────────── */}
          {hopDistribution && (
            <div className="panel mb-6">
              <div className="panel__head">
                <div className="t">Hop distribution across the affected set</div>
                <div className="r">
                  {hopDistribution.placed} of {hopDistribution.total} placed · depth {hopDistribution.maxHop}
                </div>
              </div>
              <div className="panel__body">
                {/* Each row is one hop. Width is the share of the peak count, so
                    the tallest bar fills the row and the rest read against it.
                    Colour walks from forest to signal as depth increases, which
                    is the same language the risk gauge uses. */}
                <div className="hopbars">
                  {hopDistribution.bars.map(({ hop, count }) => {
                    const share = count / hopDistribution.peak;
                    const colour =
                      hop === 1 ? 'var(--forest)'
                      : hop === 2 ? '#1c5748'
                      : hop === 3 ? 'var(--emerald)'
                      : hop === 4 ? '#3f9e7c'
                      : hop === 5 ? 'var(--amber)'
                      : 'var(--signal)';
                    return (
                      <div
                        key={hop}
                        className="hopbar"
                        title={`${count} file${count === 1 ? '' : 's'} at ${hop} hop${hop === 1 ? '' : 's'} from the target`}
                      >
                        <span className="hopbar__k">{hop} hop{hop === 1 ? '' : 's'}</span>
                        <div className="hopbar__track">
                          <div
                            className="hopbar__fill"
                            style={{ width: `${Math.max(2, share * 100)}%`, background: colour }}
                          />
                        </div>
                        <span className="hopbar__n">{count}</span>
                      </div>
                    );
                  })}
                </div>
                {hopDistribution.placed < hopDistribution.total && (
                  <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-ink-3">
                    {hopDistribution.total - hopDistribution.placed} affected file
                    {hopDistribution.total - hopDistribution.placed === 1 ? '' : 's'} could not be
                    placed by hop from this graph and {hopDistribution.total - hopDistribution.placed === 1 ? 'is' : 'are'} not
                    shown above. The total affected count is unaffected.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── blast-radius hierarchy + inspector ─────────────────────── */}
          <div className="impact-grid">
            {/* left — hierarchy */}
            <div className="space-y-6">
              {/* level 0 */}
              <div className="panel">
                <div className="panel__head">
                  <div className="t">Level 00 — target root</div>
                  <div className="r">{targetRole}</div>
                </div>
                <div className="panel__body">
                  <h2 className="break-all font-mono text-[14px] font-semibold text-ink">
                    {selectedFile.split('/').pop()}
                  </h2>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-ink-3">{selectedFile}</p>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 border-t border-rule pt-3 sm:grid-cols-3">
                    <div className="ikv">
                      <span className="k">Imports outbound</span>
                      <span className="v">{dependencyGraph?.[selectedFile.replace(/\\/g, '/')]?.length || 0}</span>
                    </div>
                    <div className="ikv">
                      <span className="k">Direct inbound</span>
                      <span className="v">{directDependents.length}</span>
                    </div>
                    <div className="ikv">
                      <span className="k">Size</span>
                      <span className="v">{targetFileItem ? formatBytes(targetFileItem.size) : '—'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleInspectNode(selectedFile);
                      toast.success('Inspecting origin target', { duration: 1500 });
                    }}
                    className="abtn abtn--ghost mt-4 w-full justify-between"
                  >
                    <span>Inspect origin details</span>
                    <span className="text-ink-3">→</span>
                  </button>
                </div>
              </div>

              {/* level 1 */}
              <div className="panel">
                <div className="panel__head">
                  <div className="t">Level 01 — direct impact · {directDependents.length}</div>
                  <div className="h">
                    {directDependents.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllDirect(prev => !prev)}
                        className="font-mono text-[9px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
                      >
                        {showAllDirect ? 'Show fewer' : `Show all ${directDependents.length}`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="panel__body !p-0">
                  {directDependents.length > 0 ? (
                    (showAllDirect ? directDependents : directDependents.slice(0, 6)).map(dep => {
                      const role = detectArchitecturalRole(dep, astMetadata?.[dep], entryPoints);
                      const isInspected = inspectedFile === dep;
                      const subCascade = (result.affectedFiles || []).filter(
                        af => af !== dep && dependencyGraph?.[af]?.includes(dep)
                      ).length;

                      return (
                        <button
                          key={dep}
                          type="button"
                          // eslint-disable-next-line react-hooks/refs -- handler only, never during render
                          onClick={() => handleInspectNode(dep)}
                          title={dep}
                          className={`deprow w-full text-left transition-colors hover:bg-paper-3 ${
                            isInspected ? 'bg-paper-3' : ''
                          }`}
                        >
                          <span className="ic shrink-0">
                            {(dep.split('.').pop() || '??').slice(0, 3).toUpperCase()}
                          </span>
                          <span className="p">
                            {dep.split('/').pop()}
                            <span className="ml-2 text-[9.5px] text-ink-3">{role}</span>
                          </span>
                          <span className="k">Direct consumer</span>
                          <span className="h">{subCascade > 0 ? `+${subCascade}` : '—'}</span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="fchain__none p-6 text-center">
                      No direct consumers found. This file is not directly imported by any other file.
                    </div>
                  )}
                </div>
              </div>

              {/* level 2+ */}
              {indirectDependents.length > 0 && (
                <div className="panel">
                  <div className="panel__head">
                    <div className="t">Level 02+ — indirect blast radius · {indirectDependents.length}</div>
                    <div className="h">
                      {indirectDependents.length > 8 && (
                        <button
                          type="button"
                          onClick={() => setShowAllIndirect(prev => !prev)}
                          className="font-mono text-[9px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
                        >
                          {showAllIndirect ? 'Show fewer' : `Show all ${indirectDependents.length}`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="panel__body !p-0">
                    {(showAllIndirect ? indirectDependents : indirectDependents.slice(0, 8)).map(ind => {
                      const role = detectArchitecturalRole(ind, astMetadata?.[ind], entryPoints);
                      const isInspected = inspectedFile === ind;
                      const bridge = getProvenanceBridge(ind);

                      return (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => handleInspectNode(ind)}
                          title={ind}
                          className={`deprow w-full text-left transition-colors hover:bg-paper-3 ${
                            isInspected ? 'bg-paper-3' : ''
                          }`}
                        >
                          <span className="ic shrink-0">
                            {(ind.split('.').pop() || '??').slice(0, 3).toUpperCase()}
                          </span>
                          <span className="p">
                            {ind.split('/').pop()}
                            <span className="ml-2 text-[9.5px] text-ink-3">{role}</span>
                          </span>
                          <span className="k">Bridge</span>
                          <span className="h truncate" title={bridge || 'intermediate'}>
                            {bridge ? bridge.split('/').pop() : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* affected routes */}
              {result.categories.routes.length > 0 && (
                <div className="panel">
                  <div className="panel__head">
                    <div className="t">Affected API &amp; ingress surfaces · {result.categories.routes.length}</div>
                    <div className="h">
                      {result.categories.routes.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowAllRoutes(prev => !prev)}
                          className="font-mono text-[9px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
                        >
                          {showAllRoutes ? 'Show fewer' : `Show all ${result.categories.routes.length}`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="panel__body !p-0">
                    {(showAllRoutes ? result.categories.routes : result.categories.routes.slice(0, 4)).map(route => {
                      const isInspected = inspectedFile === route;
                      return (
                        <button
                          key={route}
                          type="button"
                          onClick={() => handleInspectNode(route)}
                          title={route}
                          className={`deprow w-full text-left transition-colors hover:bg-paper-3 ${
                            isInspected ? 'bg-paper-3' : ''
                          }`}
                        >
                          <span className="ic shrink-0">
                            {(route.split('.').pop() || '??').slice(0, 3).toUpperCase()}
                          </span>
                          <span className="p">{route.split('/').pop()}</span>
                          <span className="k k--risk">Route</span>
                          <span className="h">{route.split('/').length - 1} segments</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* isolated module */}
              {result.affectedFilesCount === 0 && (
                <div className="panel">
                  <div className="panel__body py-10 text-center">
                    <span className="st st--ok inline-flex">
                      <i />
                      Isolated module
                    </span>
                    <p className="mx-auto mt-3 max-w-[52ch] text-[12.5px] leading-[1.65] text-ink-2">
                      This file is not imported by other modules in the codebase. Modifying its internal
                      implementation or exports is safe and will not cascade to downstream consumers.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* right — inspector */}
            <div className="sticky top-[72px] space-y-5" ref={inspectorRef}>
              <div className={`panel transition-shadow duration-500 ${isInspectorPulsing ? 'ring-2 ring-emerald' : ''}`}>
                <div className="panel__head">
                  <div className="t">Affected node inspector</div>
                  <div className="r">
                    {inspectedFile === selectedFile ? 'Origin target' : inspectedFile ? 'Active investigation' : ''}
                  </div>
                </div>

                {inspectedFile ? (
                  <div className="panel__body space-y-4">
                    {/* identification */}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[9px] uppercase text-ink-2">
                          {inspectedNodeRole}
                        </span>
                        {inspectedFile === selectedFile ? (
                          <span className="st st--ok">
                            <i />
                            Simulation target
                          </span>
                        ) : directDependents.includes(inspectedFile) ? (
                          <span className="st st--warn">
                            <i />
                            Direct consumer
                          </span>
                        ) : (
                          <span className="st st--idle">
                            <i />
                            Indirect consumer
                          </span>
                        )}
                      </div>

                      <h3 className="mt-2 break-all font-mono text-[13px] font-semibold text-ink">
                        {inspectedFile.split('/').pop()}
                      </h3>
                      <p className="mt-0.5 break-all font-mono text-[10px] text-ink-3">{inspectedFile}</p>
                    </div>

                    {/* provenance */}
                    <div className="border-t border-rule pt-3">
                      <div className="intel__k">Why is this in the blast radius?</div>
                      <p className="text-[12px] leading-[1.62] text-ink-2">
                        {inspectedFile === selectedFile ? (
                          'This is the root target file undergoing modification. Any changes to its exports or behaviour initiate the downstream cascade.'
                        ) : directDependents.includes(inspectedFile) ? (
                          <>
                            Directly imports{' '}
                            <code className="font-mono text-emerald">{selectedFile.split('/').pop()}</code>.
                            Modifying exported types, functions, or schemas can cause compile errors or runtime
                            divergence here.
                          </>
                        ) : (
                          <>
                            Transitively impacted through intermediate bridge{' '}
                            <code className="font-mono text-ink">
                              {getProvenanceBridge(inspectedFile)?.split('/').pop() || 'upstream dependent'}
                            </code>
                            . Modifying the target propagates through the dependency pipeline into this file.
                          </>
                        )}
                      </p>
                    </div>

                    {/* metrics */}
                    <div className="grid grid-cols-2 gap-x-4 border-t border-rule pt-3">
                      <div className="ikv">
                        <span className="k">Outbound imports</span>
                        <span className="v">{dependencyGraph?.[inspectedFile]?.length || 0}</span>
                      </div>
                      <div className="ikv">
                        <span className="k">File scale</span>
                        <span className="v">{inspectedNodeItem ? `${inspectedNodeItem.lines} lines` : '—'}</span>
                      </div>
                    </div>

                    {/* AST evidence */}
                    {inspectedNodeAst && (
                      <div className="border-t border-rule pt-3">
                        <div className="intel__k">AST evidence in file</div>

                        {Array.isArray(inspectedNodeAst.functions) && inspectedNodeAst.functions.length > 0 && (
                          <div className="mb-2">
                            <span className="figcap">Functions</span>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {inspectedNodeAst.functions.slice(0, 4).map((fn: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2"
                                >
                                  {typeof fn === 'string' ? fn : fn?.name || 'anonymous'}()
                                </span>
                              ))}
                              {inspectedNodeAst.functions.length > 4 && (
                                <span className="self-center font-mono text-[9px] text-ink-3">
                                  +{inspectedNodeAst.functions.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {Array.isArray(inspectedNodeAst.exports) && inspectedNodeAst.exports.length > 0 && (
                          <div>
                            <span className="figcap">Exports</span>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {inspectedNodeAst.exports.slice(0, 4).map((exp: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-2"
                                >
                                  {typeof exp === 'string' ? exp : exp?.name || 'export'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* actions */}
                    <div className="space-y-2 border-t border-rule pt-3">
                      <div className="intel__k">Cross-workspace investigation</div>

                      {inspectedFile !== selectedFile && (
                        <button
                          type="button"
                          onClick={() => selectTargetFile(inspectedFile)}
                          className="abtn abtn--solid w-full justify-between"
                        >
                          <span>Simulate this file as target</span>
                          <span>→</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectInvestigationTarget?.(inspectedFile);
                          onNavigateToExplorer(inspectedFile);
                        }}
                        className="abtn abtn--ghost w-full justify-between"
                      >
                        <span>Inspect in code explorer</span>
                        <span className="text-ink-3">→</span>
                      </button>

                      {onNavigateToGraph && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectInvestigationTarget?.(inspectedFile);
                            onNavigateToGraph(inspectedFile);
                          }}
                          className="abtn abtn--ghost w-full justify-between"
                        >
                          <span>View in architecture graph</span>
                          <span className="text-ink-3">→</span>
                        </button>
                      )}

                      {onNavigateToTrace && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectInvestigationTarget?.(inspectedFile);
                            onNavigateToTrace(inspectedFile);
                          }}
                          className="abtn abtn--ghost w-full justify-between"
                        >
                          <span>Trace execution flow</span>
                          <span className="text-ink-3">→</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onTriggerChatQuery(
                            `In our impact analysis of "${selectedFile}", we found that "${inspectedFile}" is affected. What contracts or functions are most at risk of breaking?`
                          )
                        }
                        className="abtn w-full justify-between"
                      >
                        <span>Ask Archon about this file</span>
                        <span className="text-ink-3">→</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="panel__body text-center font-mono text-[11.5px] leading-[1.7] text-ink-3">
                    Select any node in the blast-radius hierarchy to inspect its causal provenance, AST evidence,
                    and cross-workspace actions.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}