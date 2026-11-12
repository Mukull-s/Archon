import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../lib/api';
import { detectArchitecturalRole } from './explorer/explorerUtils';
import { ArchitecturalRole, FileItem } from './explorer/explorerTypes';

export interface ExecutionTracingProps {
  repositoryId: string;
  scannedFiles: FileItem[];
  dependencyGraph: Record<string, string[]>;
  astMetadata: Record<
    string,
    {
      imports: string[];
      exports: string[];
      classes: any[];
      functions: any[];
    }
  >;
  investigationTarget?: string | null;
  onSelectInvestigationTarget?: (filePath: string) => void;
  onNavigateToExplorer: (filePath: string) => void;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onTriggerChatQuery: (query: string) => void;
  entryPoints?: string[];
  framework?: string | null;
}

export interface TraceStepNode {
  id: string;
  filePath: string;
  name: string;
  role: ArchitecturalRole;
  stageName: string;
  stageIndex: number;
  branchIndex?: number;
  totalBranchesInStage?: number;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'MID' | 'JOB' | 'ENTRY';
  description: string;
  confidence: 'DIRECT_AST' | 'DEPENDENCY_LINK' | 'INFERRED';
  confidenceReason: string;
  inboundCallers: string[];
  outboundCallees: string[];
  functions: string[];
  exports: string[];
  imports: string[];
  classes: string[];
  lines: number;
  size: number;
  isCentralityHotspot?: boolean;
}

interface RepositoryStory {
  domain?: string;
  architectureType?: string;
  executionFlowStory?: string;
  coreHotspots?: string[];
}

interface InsightData {
  centralityHotspots?: Array<{ filePath: string; inDegree: number }>;
  circularDependencies?: string[][];
  deadCode?: string[];
}

/**
 * The role vocabulary. Labels only — the material (colour, rule weight) lives
 * in the Plate & Paper classes. `variant` selects the node treatment: the
 * ingress node is signal-printed, the service node emerald.
 */
const ROLE_LABELS: Record<string, string> = {
  ROUTE: 'Route / Ingress',
  'ENTRY POINT': 'Entry point',
  CONTROLLER: 'Controller / Handler',
  SERVICE: 'Domain service',
  MODEL: 'Data / Entity model',
  COMPONENT: 'UI / Component',
  UTILITY: 'Utility / Helper',
  CONFIG: 'Configuration',
  TEST: 'Test suite',
  MODULE: 'Module'
};

const roleLabel = (role: ArchitecturalRole) => ROLE_LABELS[role] || ROLE_LABELS.MODULE;

export default function ExecutionTracing({
  repositoryId,
  scannedFiles = [],
  dependencyGraph = {},
  astMetadata = {},
  investigationTarget,
  onSelectInvestigationTarget,
  onNavigateToExplorer,
  onNavigateToGraph,
  onNavigateToImpact,
  onTriggerChatQuery,
  entryPoints = [],
  framework
}: ExecutionTracingProps) {
  // ─── STATE ─────────────────────────────────────────────────────────────
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [selectedStepId, setSelectedStepId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'routes' | 'middlewares' | 'services'>('all');
  const [story, setStory] = useState<RepositoryStory | null>(null);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loadingBackendStory, setLoadingBackendStory] = useState(false);
  const [storyExpanded, setStoryExpanded] = useState(false);

  // ─── FETCH BACKEND STORY & INSIGHTS ────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const fetchStoryAndInsights = async () => {
      setLoadingBackendStory(true);
      try {
        const [storyRes, insightsRes] = await Promise.allSettled([
          api.get(`/repos/${repositoryId}/story`),
          api.get(`/repos/${repositoryId}/insights`)
        ]);

        if (!isMounted) return;

        if (storyRes.status === 'fulfilled' && storyRes.value.data?.data) {
          setStory(storyRes.value.data.data);
        }
        if (insightsRes.status === 'fulfilled' && insightsRes.value.data?.data) {
          setInsights(insightsRes.value.data.data);
        }
      } catch (err) {
        console.warn('Backend execution story fetch non-fatal:', err);
      } finally {
        if (isMounted) setLoadingBackendStory(false);
      }
    };

    fetchStoryAndInsights();
    return () => {
      isMounted = false;
    };
  }, [repositoryId]);

  // Set of centrality hotspots from insights
  const hotspotSet = useMemo(() => {
    const set = new Set<string>();
    if (insights?.centralityHotspots) {
      insights.centralityHotspots.slice(0, 10).forEach(h => set.add(h.filePath));
    }
    return set;
  }, [insights]);

  // ─── EXTRACT ALL ENTRY POINTS & ROUTES ─────────────────────────────────
  const allEntryPoints = useMemo(() => {
    if (!scannedFiles || scannedFiles.length === 0) return [];

    const list: Array<{
      path: string;
      name: string;
      role: ArchitecturalRole;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'MID' | 'JOB' | 'ENTRY';
      lines: number;
      size: number;
      downstreamCount: number;
    }> = [];

    const visited = new Set<string>();

    scannedFiles.forEach(f => {
      const p = f.path.replace(/\\/g, '/');
      const lower = p.toLowerCase();

      // Check if it qualifies as an execution entry point
      const isRoute =
        lower.includes('/routes/') ||
        lower.includes('/route/') ||
        lower.includes('.routes.') ||
        lower.includes('.route.') ||
        lower.includes('/api/') ||
        lower.includes('routing');

      const isMiddleware =
        lower.includes('middleware') ||
        lower.includes('guard') ||
        lower.includes('jwt') ||
        lower.includes('interceptor');

      const isExplicitEntry =
        Array.isArray(entryPoints) &&
        entryPoints.some(ep => ep.replace(/\\/g, '/').toLowerCase() === lower);

      const isMainOrApp =
        lower.endsWith('server.ts') ||
        lower.endsWith('server.js') ||
        lower.endsWith('app.ts') ||
        lower.endsWith('app.js') ||
        lower.endsWith('main.ts') ||
        lower.endsWith('main.tsx') ||
        lower.endsWith('app.tsx') ||
        lower.endsWith('index.ts') ||
        lower.endsWith('index.js');

      if (isRoute || isMiddleware || isExplicitEntry || isMainOrApp) {
        if (!visited.has(p)) {
          visited.add(p);
          const ast = astMetadata[p];
          const role = detectArchitecturalRole(p, ast, entryPoints);

          let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'MID' | 'JOB' | 'ENTRY' = 'GET';

          if (isMiddleware) {
            method = 'MID';
          } else if (isExplicitEntry || isMainOrApp) {
            method = 'ENTRY';
          } else {
            // Infer method from route naming or AST export functions
            if (lower.includes('post') || lower.includes('create') || lower.includes('upload')) {
              method = 'POST';
            } else if (lower.includes('put') || lower.includes('update')) {
              method = 'PUT';
            } else if (lower.includes('delete') || lower.includes('remove')) {
              method = 'DELETE';
            } else if (lower.includes('patch')) {
              method = 'PATCH';
            } else {
              method = 'GET';
            }
          }

          const deps = dependencyGraph[p] || [];

          list.push({
            path: p,
            name: p.split('/').pop() || p,
            role,
            method,
            lines: f.lines || 0,
            size: f.size || 0,
            downstreamCount: deps.length
          });
        }
      }
    });

    // Sort: Route files first, then entry points, then middlewares
    return list.sort((a, b) => {
      const aWeight = a.role === 'ROUTE' ? 3 : a.role === 'ENTRY POINT' ? 2 : 1;
      const bWeight = b.role === 'ROUTE' ? 3 : b.role === 'ENTRY POINT' ? 2 : 1;
      if (aWeight !== bWeight) return bWeight - aWeight;
      return b.downstreamCount - a.downstreamCount;
    });
  }, [scannedFiles, dependencyGraph, astMetadata, entryPoints]);

  // Sync with investigationTarget or initial route
  useEffect(() => {
    if (investigationTarget) {
      const match = allEntryPoints.find(
        e => e.path.toLowerCase() === investigationTarget.replace(/\\/g, '/').toLowerCase()
      );
      if (match) {
        setSelectedRoute(match.path);
        return;
      }
      // Or check if investigationTarget is imported by any route
      const callerRoute = allEntryPoints.find(e => {
        const deps = dependencyGraph[e.path] || [];
        return deps.some(d => d.replace(/\\/g, '/').toLowerCase() === investigationTarget.replace(/\\/g, '/').toLowerCase());
      });
      if (callerRoute) {
        setSelectedRoute(callerRoute.path);
        setSelectedStepId(investigationTarget);
        return;
      }
    }

    if (!selectedRoute && allEntryPoints.length > 0) {
      setSelectedRoute(allEntryPoints[0].path);
    }
  }, [investigationTarget, allEntryPoints, selectedRoute, dependencyGraph]);

  // Filter entry points
  const filteredEntryPoints = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allEntryPoints.filter(e => {
      const matchesSearch = e.path.toLowerCase().includes(q) || e.name.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (filterType === 'routes') return e.role === 'ROUTE';
      if (filterType === 'middlewares') return e.method === 'MID';
      if (filterType === 'services') return e.role === 'SERVICE' || e.role === 'CONTROLLER';
      return true;
    });
  }, [allEntryPoints, searchQuery, filterType]);

  // ─── RESOLVE BARREL & RE-EXPORTS INTELLIGENTLY ──────────────────────────
  // Resolves barrel re-exports like `controllers/index.ts` -> `repo.controller.ts`
  const resolveConcreteDependencies = useCallback(
    (sourcePath: string, directDeps: string[]): string[] => {
      const resolved: string[] = [];
      const visited = new Set<string>();

      for (const dep of directDeps) {
        const normDep = dep.replace(/\\/g, '/');
        const isBarrel = normDep.endsWith('/index.ts') || normDep.endsWith('/index.js') || normDep.endsWith('/index.tsx');

        if (isBarrel && !visited.has(normDep)) {
          visited.add(normDep);
          // Look for sibling files in the same directory that exist in scannedFiles
          const dir = normDep.substring(0, normDep.lastIndexOf('/'));
          const siblings = scannedFiles
            .map(f => f.path.replace(/\\/g, '/'))
            .filter(p => p.startsWith(dir + '/') && p !== normDep);

          if (siblings.length > 0) {
            // Include both the barrel and the concrete siblings
            resolved.push(normDep);
            siblings.forEach(sib => {
              if (!visited.has(sib)) {
                visited.add(sib);
                resolved.push(sib);
              }
            });
            continue;
          }
        }

        if (!visited.has(normDep)) {
          visited.add(normDep);
          resolved.push(normDep);
        }
      }

      return resolved;
    },
    [scannedFiles]
  );

  // ─── BUILD REAL EXECUTION TRACE STAGES (GROUNDED EVIDENCE) ──────────────
  const { traceStages, allTraceSteps } = useMemo(() => {
    if (!selectedRoute) return { traceStages: [], allTraceSteps: [] };

    const fileMap = new Map<string, FileItem>();
    scannedFiles.forEach(f => fileMap.set(f.path.replace(/\\/g, '/'), f));

    const stepsById = new Map<string, TraceStepNode>();
    const visitedFiles = new Set<string>();

    const makeNode = (
      filePath: string,
      stageIndex: number,
      stageName: string,
      confidence: 'DIRECT_AST' | 'DEPENDENCY_LINK' | 'INFERRED',
      confidenceReason: string,
      inbound: string[],
      branchIndex?: number,
      totalBranches?: number
    ): TraceStepNode => {
      const norm = filePath.replace(/\\/g, '/');
      const ast = astMetadata[norm] || { imports: [], exports: [], classes: [], functions: [] };
      const fItem = fileMap.get(norm);
      const role = detectArchitecturalRole(norm, ast, entryPoints);

      const fns = Array.isArray(ast.functions)
        ? ast.functions.map(f => (typeof f === 'string' ? f : f?.name || '')).filter(Boolean)
        : [];
      const exps = Array.isArray(ast.exports)
        ? ast.exports.filter(Boolean)
        : ast.exports
        ? Object.keys(ast.exports)
        : [];
      const imps = Array.isArray(ast.imports) ? ast.imports.filter(Boolean) : [];
      const cls = Array.isArray(ast.classes)
        ? ast.classes.map(c => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean)
        : [];

      // Determine human description grounded in evidence
      let desc = '';
      if (role === 'ROUTE') {
        desc = `Handles ingress HTTP requests, mounts endpoint route bindings, and dispatches to handler.`;
      } else if (role === 'CONTROLLER') {
        desc = `Unpacks request arguments, applies input schema validations, and orchestrates domain operations.`;
      } else if (role === 'SERVICE') {
        desc = `Executes core domain logic, manages transactional boundaries, and coordinates state.`;
      } else if (role === 'MODEL') {
        desc = `Defines persistent schema entities and executes database queries / mutations.`;
      } else if (role === 'CONFIG') {
        desc = `Supplies runtime environment parameters, database pool handles, or client clients.`;
      } else if (role === 'COMPONENT') {
        desc = `Renders UI structure, responds to user interactions, and dispatches application actions.`;
      } else {
        desc = `Modular unit participating in the downstream execution pipeline.`;
      }

      return {
        id: norm,
        filePath: norm,
        name: norm.split('/').pop() || norm,
        role,
        stageName,
        stageIndex,
        branchIndex,
        totalBranchesInStage: totalBranches,
        description: desc,
        confidence,
        confidenceReason,
        inboundCallers: inbound,
        outboundCallees: [],
        functions: fns,
        exports: exps,
        imports: imps,
        classes: cls,
        lines: fItem?.lines || 0,
        size: fItem?.size || 0,
        isCentralityHotspot: hotspotSet.has(norm)
      };
    };

    const stages: Array<{
      stageIndex: number;
      stageName: string;
      role: ArchitecturalRole;
      steps: TraceStepNode[];
      isBranching: boolean;
    }> = [];

    // ── STAGE 0: INGRESS / ROUTE ENTRY ──
    const rootNorm = selectedRoute.replace(/\\/g, '/');
    visitedFiles.add(rootNorm);
    const rootNode = makeNode(
      rootNorm,
      0,
      'Ingress Entry',
      'DIRECT_AST',
      'Entry point identified from repository routing architecture',
      []
    );
    stepsById.set(rootNorm, rootNode);

    stages.push({
      stageIndex: 0,
      stageName: 'Ingress Entry',
      role: rootNode.role,
      steps: [rootNode],
      isBranching: false
    });

    // Trace downstream from root
    let currentInbound = [rootNorm];
    const rawDirectDeps = dependencyGraph[rootNorm] || [];
    const directDeps = resolveConcreteDependencies(rootNorm, rawDirectDeps);

    // Filter out visited
    const unvisitedDirect = directDeps.filter(d => !visitedFiles.has(d.replace(/\\/g, '/')));

    // Classify direct downstream dependencies:
    // 1. Middlewares & Guards
    const middlewares = unvisitedDirect.filter(d => {
      const lower = d.toLowerCase();
      return (
        lower.includes('middleware') ||
        lower.includes('auth') ||
        lower.includes('guard') ||
        lower.includes('jwt') ||
        lower.includes('cors') ||
        lower.includes('validation')
      );
    });

    // 2. Controllers / Action Handlers
    const controllers = unvisitedDirect.filter(d => {
      const lower = d.toLowerCase();
      return (
        !middlewares.includes(d) &&
        (lower.includes('controller') ||
          lower.includes('/controllers/') ||
          lower.includes('handler') ||
          (astMetadata[d]?.classes &&
            astMetadata[d].classes.some((c: any) => c?.name?.toLowerCase()?.endsWith('controller'))))
      );
    });

    // 3. Other direct domain modules if no explicit controller (e.g. services or components)
    const directServices = unvisitedDirect.filter(d => {
      const lower = d.toLowerCase();
      return (
        !middlewares.includes(d) &&
        !controllers.includes(d) &&
        (lower.includes('service') || lower.includes('/services/'))
      );
    });

    let stageCounter = 1;

    // ── STAGE 1: MIDDLEWARE & INTERCEPTORS (If present) ──
    if (middlewares.length > 0) {
      const midNodes: TraceStepNode[] = [];
      middlewares.forEach((m, idx) => {
        const mNorm = m.replace(/\\/g, '/');
        visitedFiles.add(mNorm);
        const node = makeNode(
          mNorm,
          stageCounter,
          'Middleware & Guard',
          'DIRECT_AST',
          `Directly imported by route ${rootNode.name} as request interceptor`,
          currentInbound,
          idx,
          middlewares.length
        );
        stepsById.set(mNorm, node);
        rootNode.outboundCallees.push(mNorm);
        midNodes.push(node);
      });

      stages.push({
        stageIndex: stageCounter,
        stageName: 'Middleware & Security',
        role: 'CONFIG',
        steps: midNodes,
        isBranching: midNodes.length > 1
      });

      stageCounter++;
      currentInbound = middlewares.map(m => m.replace(/\\/g, '/'));
    }

    // ── STAGE 2: CONTROLLER / HANDLER (If present) ──
    const activeControllers = controllers.length > 0 ? controllers : [];
    if (activeControllers.length > 0) {
      const ctrlNodes: TraceStepNode[] = [];
      activeControllers.forEach((c, idx) => {
        const cNorm = c.replace(/\\/g, '/');
        visitedFiles.add(cNorm);
        const node = makeNode(
          cNorm,
          stageCounter,
          'Controller / Handler',
          'DIRECT_AST',
          `Direct handler dispatched to process incoming route parameters`,
          currentInbound,
          idx,
          activeControllers.length
        );
        stepsById.set(cNorm, node);
        // Link upstream callers
        currentInbound.forEach(inp => {
          const p = stepsById.get(inp);
          if (p && !p.outboundCallees.includes(cNorm)) p.outboundCallees.push(cNorm);
        });
        ctrlNodes.push(node);
      });

      stages.push({
        stageIndex: stageCounter,
        stageName: 'Controller & Orchestration',
        role: 'CONTROLLER',
        steps: ctrlNodes,
        isBranching: ctrlNodes.length > 1
      });

      stageCounter++;
      currentInbound = activeControllers.map(c => c.replace(/\\/g, '/'));
    }

    // ── STAGE 3: DOMAIN SERVICES (Downstream from Controllers or Direct) ──
    const serviceCandidates: string[] = [...directServices];
    // Gather all dependencies from controllers
    for (const ctrlPath of activeControllers) {
      const ctrlDeps = resolveConcreteDependencies(ctrlPath, dependencyGraph[ctrlPath] || []);
      ctrlDeps.forEach(dep => {
        const lower = dep.toLowerCase();
        if (
          !visitedFiles.has(dep.replace(/\\/g, '/')) &&
          (lower.includes('service') || lower.includes('/services/'))
        ) {
          if (!serviceCandidates.includes(dep)) serviceCandidates.push(dep);
        }
      });
    }

    if (serviceCandidates.length > 0) {
      const svcNodes: TraceStepNode[] = [];
      serviceCandidates.forEach((s, idx) => {
        const sNorm = s.replace(/\\/g, '/');
        visitedFiles.add(sNorm);
        const node = makeNode(
          sNorm,
          stageCounter,
          'Domain Service',
          'DIRECT_AST',
          `Invoked to execute core domain business operations and business rules`,
          currentInbound,
          idx,
          serviceCandidates.length
        );
        stepsById.set(sNorm, node);
        currentInbound.forEach(inp => {
          const p = stepsById.get(inp);
          if (p && !p.outboundCallees.includes(sNorm)) p.outboundCallees.push(sNorm);
        });
        svcNodes.push(node);
      });

      stages.push({
        stageIndex: stageCounter,
        stageName: 'Domain Logic & Services',
        role: 'SERVICE',
        steps: svcNodes,
        isBranching: svcNodes.length > 1
      });

      stageCounter++;
      currentInbound = serviceCandidates.map(s => s.replace(/\\/g, '/'));
    }

    // ── STAGE 4: DATA / MODEL / DATABASE (Downstream from Services or Controllers) ──
    const modelCandidates: string[] = [];
    for (const upstream of currentInbound) {
      const upstreamDeps = resolveConcreteDependencies(upstream, dependencyGraph[upstream] || []);
      upstreamDeps.forEach(dep => {
        const lower = dep.toLowerCase();
        const normDep = dep.replace(/\\/g, '/');
        if (
          !visitedFiles.has(normDep) &&
          (lower.includes('model') ||
            lower.includes('/models/') ||
            lower.includes('schema') ||
            lower.includes('database') ||
            lower.includes('prisma') ||
            lower.includes('repository') ||
            lower.includes('/repo/') ||
            lower.endsWith('.prisma'))
        ) {
          if (!modelCandidates.includes(normDep)) modelCandidates.push(normDep);
        }
      });
    }

    if (modelCandidates.length > 0) {
      const modelNodes: TraceStepNode[] = [];
      modelCandidates.forEach((m, idx) => {
        visitedFiles.add(m);
        const node = makeNode(
          m,
          stageCounter,
          'Data & Persistence',
          'DEPENDENCY_LINK',
          `State persistence layer handling schema queries, relations, and entity storage`,
          currentInbound,
          idx,
          modelCandidates.length
        );
        stepsById.set(m, node);
        currentInbound.forEach(inp => {
          const p = stepsById.get(inp);
          if (p && !p.outboundCallees.includes(m)) p.outboundCallees.push(m);
        });
        modelNodes.push(node);
      });

      stages.push({
        stageIndex: stageCounter,
        stageName: 'Data & Persistence',
        role: 'MODEL',
        steps: modelNodes,
        isBranching: modelNodes.length > 1
      });

      stageCounter++;
      currentInbound = modelCandidates;
    }

    // ── FRONTEND / COMPONENT TREE SUPPORT (If application is React/Vue/Frontend) ──
    // If no backend layers were found, trace direct UI component tree hierarchy
    if (stages.length === 1 && unvisitedDirect.length > 0) {
      const compSteps: TraceStepNode[] = [];
      unvisitedDirect.slice(0, 8).forEach((dep, idx) => {
        const norm = dep.replace(/\\/g, '/');
        visitedFiles.add(norm);
        const node = makeNode(
          norm,
          1,
          'Component Hierarchy',
          'DIRECT_AST',
          `Direct downstream component/module initialized from application entry point`,
          [rootNorm],
          idx,
          Math.min(unvisitedDirect.length, 8)
        );
        stepsById.set(norm, node);
        rootNode.outboundCallees.push(norm);
        compSteps.push(node);
      });

      stages.push({
        stageIndex: 1,
        stageName: 'Component Hierarchy & Direct Imports',
        role: 'COMPONENT',
        steps: compSteps,
        isBranching: compSteps.length > 1
      });
    }

    const flatSteps = Array.from(stepsById.values());
    return { traceStages: stages, allTraceSteps: flatSteps };
  }, [selectedRoute, scannedFiles, dependencyGraph, astMetadata, entryPoints, hotspotSet, resolveConcreteDependencies]);

  // Set active selected step
  useEffect(() => {
    if (allTraceSteps.length > 0) {
      if (selectedStepId && allTraceSteps.some(s => s.id === selectedStepId)) {
        // Keep current selected
        return;
      }
      setSelectedStepId(allTraceSteps[0].id);
    } else {
      setSelectedStepId('');
    }
  }, [allTraceSteps, selectedStepId]);

  // Selected step entity
  const activeStep = useMemo(() => {
    return allTraceSteps.find(s => s.id === selectedStepId) || allTraceSteps[0] || null;
  }, [allTraceSteps, selectedStepId]);

  // Handle step selection with investigation target preservation
  const handleSelectStep = (step: TraceStepNode) => {
    setSelectedStepId(step.id);
    if (onSelectInvestigationTarget) {
      onSelectInvestigationTarget(step.filePath);
    }
  };

  // Keyboard navigation through steps
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!allTraceSteps || allTraceSteps.length === 0) return;
    const currentIndex = allTraceSteps.findIndex(s => s.id === selectedStepId);
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, allTraceSteps.length - 1);
      handleSelectStep(allTraceSteps[nextIndex]);
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      handleSelectStep(allTraceSteps[prevIndex]);
    }
  };

  // Construct context query prompts
  const getAIQuery = (actionType: 'explain' | 'optimize' | 'trace') => {
    if (!activeStep) return '';

    const flowSummary = allTraceSteps
      .map((s, i) => `${i + 1}. [${s.role}] ${s.name} (${s.filePath})`)
      .join('\n');

    if (actionType === 'optimize') {
      return `Analyze potential performance bottlenecks, redundant allocations, and latency risks in this execution path:\n\n${flowSummary}\n\nFocus specifically on step: ${activeStep.name} (${activeStep.filePath}).`;
    }
    if (actionType === 'trace') {
      return `Deep-dive execution trace: Explain how data and arguments flow into ${activeStep.name} and how it coordinates downstream calls:\n\nFull path:\n${flowSummary}`;
    }
    return `Explain what happens when this execution path runs in the codebase:\n\n${flowSummary}\n\nHighlight the role of ${activeStep.name} and how it handles errors or response payloads.`;
  };

  const traceStep = allTraceSteps.find(s => s.id === selectedStepId);
  const activeIndex = traceStep ? allTraceSteps.indexOf(traceStep) : -1;

  return (
    <div
      className="w-full focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Execution flow tracing workbench"
    >
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* header                                                           */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="khead">
        <div className="khead__l">
          <div className="eyebrow">Execution flow</div>
          <h1 className="khead__t">
            How a request <em className="serif-it">travels</em> through the codebase.
          </h1>
          <p className="khead__d">
            Each stage below is resolved from the import graph, not asserted. Pick an ingress entry
            to trace its path through middleware, controllers, services, and the data boundary.
          </p>
        </div>
        <div className="khead__r">
          {framework && (
            <span className="st st--idle">
              <i />
              {framework}
            </span>
          )}
          <span className="st st--ok">
            <i />
            {traceStages.length} stages
          </span>
        </div>
      </div>

      {/* ── metric row — all measured from the resolved trace ─────────── */}
      <div className="kmetrics">
        <div className="kmetric">
          <div className="k">Ingress entries</div>
          <div className="v">{allEntryPoints.length}</div>
          <div className="sub">routes, handlers and entry files</div>
        </div>
        <div className="kmetric">
          <div className="k">Trace depth</div>
          <div className="v">
            {traceStages.length}
            <small>stages</small>
          </div>
          <div className="sub">resolved from the dependency graph</div>
        </div>
        <div className="kmetric">
          <div className="k">Traced nodes</div>
          <div className="v">{allTraceSteps.length}</div>
          <div className="sub">files materialised in the path</div>
        </div>
        <div className="kmetric">
          <div className="k">Centrality hotspots</div>
          <div className="v">{hotspotSet.size}</div>
          <div className="sub">flagged from the insights scan</div>
        </div>
      </div>

      {/* ── backend execution-flow narrative (source of truth) ────────── */}
      {story?.executionFlowStory && (
        <div className="panel mb-6">
          <div className="panel__head">
            <div className="t">
              Execution domain — {story.architectureType || story.domain || 'Layered architecture'}
            </div>
            <button
              type="button"
              onClick={() => setStoryExpanded(!storyExpanded)}
              className="font-mono text-[9px] uppercase tracking-[0.13em] text-emerald transition-opacity hover:opacity-70"
            >
              {storyExpanded ? 'Collapse' : 'Expand narrative'}
            </button>
          </div>
          {storyExpanded && (
            <div className="panel__body whitespace-pre-line text-[12.5px] leading-[1.7] text-ink-2">
              {story.executionFlowStory}
            </div>
          )}
        </div>
      )}

      {/* ── entry selector ────────────────────────────────────────────── */}
      <div className="panel mb-6">
        <div className="panel__head flex-col items-stretch gap-3 md:flex-row md:items-center">
          {/* filter pills */}
          <div className="flex items-center gap-0.5 rounded-[3px] border border-rule bg-paper-3 p-0.5">
            {(
              [
                { id: 'all', label: 'All entry points' },
                { id: 'routes', label: 'Routes' },
                { id: 'middlewares', label: 'Middlewares' },
                { id: 'services', label: 'Services' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`rounded-[2px] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.09em] transition-colors ${
                  filterType === f.id
                    ? 'bg-paper-2 font-semibold text-ink shadow-[inset_0_-2px_0_var(--emerald)]'
                    : 'text-ink-3 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* search */}
          <div className="flex w-full items-center gap-2 rounded-[3px] border border-rule-strong bg-paper-2 px-3 py-1.5 md:w-80">
            <svg className="h-3.5 w-3.5 shrink-0 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search route path, controller or service…"
              className="w-full border-none bg-transparent p-0 font-mono text-[11px] text-ink outline-none placeholder:text-ink-3 focus:ring-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-ink-3 transition-colors hover:text-ink"
                title="Clear search"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="panel__body">
          {filteredEntryPoints.length > 0 ? (
            <>
              <div className="figcap mb-2">
                Select ingress trace — <b>{filteredEntryPoints.length}</b> in view
              </div>
              <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                {filteredEntryPoints.map(ep => {
                  const isSelected = selectedRoute === ep.path;
                  return (
                    <button
                      key={ep.path}
                      type="button"
                      onClick={() => {
                        setSelectedRoute(ep.path);
                        if (onSelectInvestigationTarget) onSelectInvestigationTarget(ep.path);
                      }}
                      className={`flex flex-shrink-0 items-center gap-2 rounded-[3px] border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'border-ink bg-paper-3'
                          : 'border-rule bg-paper-2 hover:border-rule-strong'
                      }`}
                    >
                      <span className="rounded-[2px] border border-rule bg-paper-3 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-ink-2">
                        {ep.method}
                      </span>
                      <span className="flex max-w-[220px] flex-col overflow-hidden">
                        <span className="truncate font-mono text-[11.5px] font-semibold text-ink">{ep.name}</span>
                        <span className="truncate font-mono text-[9.5px] text-ink-3">{ep.path}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="fchain__none py-4 text-center">
              No entry points matched “{searchQuery}”. Try a different filter or search term.
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* workbench: trace chain + step inspector                          */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <div className="impact-grid">
        {/* LEFT — the waterfall trace */}
        <div>
          {traceStages.length === 0 ? (
            <div className="panel">
              <div className="panel__body py-12 text-center">
                <span className="figcap block">No execution trace available</span>
                <p className="mx-auto mt-3 max-w-[46ch] text-[13px] leading-[1.65] text-ink-2">
                  No route execution path could be resolved for the current selection. Pick a different
                  entry point from the selector above.
                </p>
              </div>
            </div>
          ) : (
            <div className="flow">
              {traceStages.map((stage, sIdx) => {
                const isLastStage = sIdx === traceStages.length - 1;
                return (
                  <div key={stage.stageIndex} className="fchain">
                    <div className="fchain__head">
                      <div className="ep">
                        <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-ink-3">
                          Stage {String(stage.stageIndex + 1).padStart(2, '0')}
                        </span>
                        <span className="text-ink-2">{stage.stageName}</span>
                        <span className="m">{roleLabel(stage.role)}</span>
                      </div>
                      <div className="h">
                        {stage.isBranching && (
                          <span className="st st--warn">
                            <i />
                            {stage.steps.length} parallel paths
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="fchain__body">
                      {stage.steps.map((step, bIdx) => {
                        const isSelected = activeStep?.id === step.id;
                        return (
                          <React.Fragment key={step.id}>
                            {bIdx > 0 && <span className="farw" aria-hidden="true">→</span>}
                            <button
                              type="button"
                              onClick={() => handleSelectStep(step)}
                              title={step.filePath}
                              className={`fnode ${
                                step.role === 'ROUTE' || step.role === 'ENTRY POINT'
                                  ? 'fnode--route'
                                  : step.role === 'SERVICE'
                                  ? 'fnode--svc'
                                  : ''
                              } ${isSelected ? 'ring-1 ring-emerald' : ''} text-left`}
                            >
                              <div className="ty">
                                {step.isCentralityHotspot ? `${roleLabel(step.role)} · hotspot` : roleLabel(step.role)}
                              </div>
                              <div className="nm">{step.name}</div>
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {!isLastStage && (
                      <div className="fchain__none px-4 pb-2 text-center" aria-hidden="true">
                        ↓ dispatches to
                      </div>
                    )}
                  </div>
                );
              })}

              {/* egress boundary */}
              <div className="panel">
                <div className="panel__body flex items-center justify-between gap-4">
                  <div>
                    <span className="font-mono text-[11.5px] font-semibold text-ink">Execution pipeline exit</span>
                    <span className="mt-0.5 block font-mono text-[9.5px] text-ink-3">
                      Response finalised and returned through the protocol egress boundary.
                    </span>
                  </div>
                  <span className="st st--ok">
                    <i />
                    Complete
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — step inspector */}
        <div className="sticky top-[72px]">
          {activeStep ? (
            <div className="panel">
              <div className="panel__head">
                <div className="t">
                  Stage {String(activeStep.stageIndex + 1).padStart(2, '0')} · {activeStep.stageName}
                </div>
                <div className="r">{activeIndex >= 0 ? `step ${activeIndex + 1} of ${allTraceSteps.length}` : ''}</div>
              </div>

              <div className="panel__body space-y-5">
                {/* identity */}
                <div>
                  <h2 className="break-all font-mono text-[14px] font-semibold text-ink" title={activeStep.filePath}>
                    {activeStep.name}
                  </h2>
                  <div className="mt-1 break-all font-mono text-[10px] text-ink-3" title={activeStep.filePath}>
                    {activeStep.filePath}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-ink-2">
                    <span>{activeStep.lines} lines</span>
                    <span className="text-rule-strong">·</span>
                    <span>{(activeStep.size / 1024).toFixed(1)} KB</span>
                    <span className="text-rule-strong">·</span>
                    <span className="text-emerald">Grounding {activeStep.confidence}</span>
                  </div>
                </div>

                <div className="intel__sec border-rule border-t pt-4">
                  <div className="intel__k">Execution causal provenance</div>
                  <p className="text-[12px] leading-[1.62] text-ink-2">{activeStep.confidenceReason}</p>
                </div>

                {/* links */}
                <div className="border-t border-rule pt-4">
                  <div className="intel__k">Execution links</div>

                  <div className="mb-3">
                    <span className="figcap">Called by upstream — {activeStep.inboundCallers.length}</span>
                    {activeStep.inboundCallers.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeStep.inboundCallers.map(caller => (
                          <button
                            key={caller}
                            type="button"
                            onClick={() => {
                              const target = allTraceSteps.find(s => s.id === caller);
                              if (target) handleSelectStep(target);
                            }}
                            className="max-w-[220px] truncate rounded-[2px] border border-rule bg-paper-3 px-2 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
                            title="Jump to caller"
                          >
                            {caller.split('/').pop() || caller}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="figcap mt-2 block italic">Direct entry root</span>
                    )}
                  </div>

                  <div>
                    <span className="figcap">Dispatches downstream — {activeStep.outboundCallees.length}</span>
                    {activeStep.outboundCallees.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {activeStep.outboundCallees.map(callee => (
                          <button
                            key={callee}
                            type="button"
                            onClick={() => {
                              const target = allTraceSteps.find(s => s.id === callee);
                              if (target) handleSelectStep(target);
                            }}
                            className="max-w-[220px] truncate rounded-[2px] border border-rule bg-paper-3 px-2 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
                            title="Jump to callee"
                          >
                            {callee.split('/').pop() || callee}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="figcap mt-2 block italic">No further downstream calls</span>
                    )}
                  </div>
                </div>

                {/* AST evidence */}
                <div className="border-t border-rule pt-4">
                  <div className="intel__k">AST grounded evidence</div>

                  {activeStep.functions.length > 0 && (
                    <div className="mb-3">
                      <span className="figcap">Functions declared — {activeStep.functions.length}</span>
                      <div className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1">
                        {activeStep.functions.map(fn => (
                          <span key={fn} className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[9.5px] text-ink-2">
                            {fn}()
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeStep.exports.length > 0 && (
                    <div className="mb-3">
                      <span className="figcap">Exported symbols — {activeStep.exports.length}</span>
                      <div className="mt-2 flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                        {activeStep.exports.map(exp => (
                          <span key={exp} className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[9.5px] text-ink-2">
                            {exp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeStep.classes.length > 0 && (
                    <div>
                      <span className="figcap">Classes — {activeStep.classes.length}</span>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {activeStep.classes.map(cls => (
                          <span key={cls} className="rounded-[2px] border border-rule bg-paper-3 px-2 py-0.5 font-mono text-[9.5px] text-ink-2">
                            class {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* actions */}
                <div className="space-y-2 border-t border-rule pt-4">
                  <div className="intel__k">Investigation</div>

                  <button
                    type="button"
                    onClick={() => onNavigateToExplorer(activeStep.filePath)}
                    className="abtn abtn--ghost w-full justify-between"
                  >
                    <span>Inspect in explorer</span>
                    <span className="text-ink-3">→</span>
                  </button>

                  {onNavigateToGraph && (
                    <button
                      type="button"
                      onClick={() => onNavigateToGraph(activeStep.filePath)}
                      className="abtn abtn--ghost w-full justify-between"
                    >
                      <span>View in architecture graph</span>
                      <span className="text-ink-3">→</span>
                    </button>
                  )}

                  {onNavigateToImpact && (
                    <button
                      type="button"
                      onClick={() => onNavigateToImpact(activeStep.filePath)}
                      className="abtn abtn--ghost w-full justify-between"
                    >
                      <span>Analyse blast radius</span>
                      <span className="text-ink-3">→</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onTriggerChatQuery(getAIQuery('explain'))}
                    className="abtn abtn--solid w-full"
                  >
                    Ask Archon about this step
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel__body text-center font-mono text-[11.5px] leading-[1.7] text-ink-3">
                Select any step in the trace to inspect its causal evidence, AST functions, and callers.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
