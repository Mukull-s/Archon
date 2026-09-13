import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
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

const ROLE_THEMES: Record<
  string,
  { label: string; text: string; bg: string; border: string; icon: string }
> = {
  ROUTE: {
    label: 'Route / Ingress',
    text: 'text-[#f43f5e]',
    bg: 'bg-[#f43f5e]/10',
    border: 'border-[#f43f5e]/30',
    icon: 'alt_route'
  },
  'ENTRY POINT': {
    label: 'Entry Point',
    text: 'text-[#ec4899]',
    bg: 'bg-[#ec4899]/10',
    border: 'border-[#ec4899]/30',
    icon: 'start'
  },
  CONTROLLER: {
    label: 'Controller / Handler',
    text: 'text-[#3b82f6]',
    bg: 'bg-[#3b82f6]/10',
    border: 'border-[#3b82f6]/30',
    icon: 'settings_input_component'
  },
  SERVICE: {
    label: 'Domain Service',
    text: 'text-[#f59e0b]',
    bg: 'bg-[#f59e0b]/10',
    border: 'border-[#f59e0b]/30',
    icon: 'hub'
  },
  MODEL: {
    label: 'Data / Entity Model',
    text: 'text-[#a855f7]',
    bg: 'bg-[#a855f7]/10',
    border: 'border-[#a855f7]/30',
    icon: 'database'
  },
  COMPONENT: {
    label: 'UI / Component',
    text: 'text-[#06b6d4]',
    bg: 'bg-[#06b6d4]/10',
    border: 'border-[#06b6d4]/30',
    icon: 'widgets'
  },
  UTILITY: {
    label: 'Utility / Helper',
    text: 'text-[#71717a]',
    bg: 'bg-[#27272a]/60',
    border: 'border-[#3f3f46]',
    icon: 'handyman'
  },
  CONFIG: {
    label: 'Configuration',
    text: 'text-[#8b5cf6]',
    bg: 'bg-[#8b5cf6]/10',
    border: 'border-[#8b5cf6]/30',
    icon: 'tune'
  },
  TEST: {
    label: 'Test Suite',
    text: 'text-[#10b981]',
    bg: 'bg-[#10b981]/10',
    border: 'border-[#10b981]/30',
    icon: 'verified'
  },
  MODULE: {
    label: 'Module',
    text: 'text-[#919095]',
    bg: 'bg-[#1f1f22]',
    border: 'border-[#27272a]',
    icon: 'deployed_code'
  }
};

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

  return (
    <div
      className="w-full min-h-screen text-[#fafafa] flex flex-col space-y-6 pb-20 focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Execution Flow Tracing Workbench"
    >
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP CONTEXT & SCOPE BAR                                               */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-5 shadow-sm space-y-4">
        {/* Header Title & Execution Domain */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a]/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-[#3b82f6]/10 border border-[#3b82f6]/25 flex items-center justify-center text-[#3b82f6] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[16px] font-bold tracking-tight text-white font-sans">
                  Execution Flow Tracing
                </h1>
                <span className="px-2 py-0.5 rounded-[4px] bg-[#131316] border border-[#27272a] text-[10px] font-mono text-[#919095] uppercase">
                  Investigation Surface
                </span>
                {framework && (
                  <span className="px-2 py-0.5 rounded-[4px] bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[10px] font-mono text-[#60a5fa]">
                    {framework}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#919095] mt-0.5">
                Inspect how requests propagate from entry points through controllers, domain services, and data boundaries.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <div className="bg-[#131316] border border-[#27272a] px-3 py-1.5 rounded-[4px] flex items-center gap-2">
              <span className="text-[#919095]">Discovered Routes:</span>
              <span className="text-white font-semibold">{allEntryPoints.length}</span>
            </div>
            <div className="bg-[#131316] border border-[#27272a] px-3 py-1.5 rounded-[4px] flex items-center gap-2">
              <span className="text-[#919095]">Trace Depth:</span>
              <span className="text-[#60a5fa] font-semibold">{traceStages.length} stages</span>
            </div>
            <div className="bg-[#131316] border border-[#27272a] px-3 py-1.5 rounded-[4px] flex items-center gap-2">
              <span className="text-[#919095]">Traced Nodes:</span>
              <span className="text-emerald-400 font-semibold">{allTraceSteps.length}</span>
            </div>
          </div>
        </div>

        {/* Backend Execution Flow Story (Source of Truth) */}
        {story?.executionFlowStory && (
          <div className="bg-[#131316]/70 border border-[#27272a] rounded-[6px] p-3 text-[12px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#a855f7] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span className="font-mono text-[11px] font-bold text-[#c8c5ca] uppercase tracking-wide">
                  Architectural Execution Domain:
                </span>
                <span className="text-white font-medium">
                  {story.architectureType || story.domain || 'Layered Architecture'}
                </span>
              </div>
              <button
                onClick={() => setStoryExpanded(!storyExpanded)}
                className="text-[11px] font-mono text-[#60a5fa] hover:text-[#93c5fd] cursor-pointer flex items-center gap-1"
              >
                {storyExpanded ? 'Collapse Narrative' : 'Expand Execution Narrative'}
                <svg className={`w-3.5 h-3.5 transition-transform ${storyExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
            {storyExpanded && (
              <div className="mt-2 pt-2 border-t border-[#27272a]/60 text-[#c8c5ca] font-mono text-[11px] whitespace-pre-line leading-relaxed">
                {story.executionFlowStory}
              </div>
            )}
          </div>
        )}

        {/* Entry Point / Route Selector Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#131316] p-1 rounded-[6px] border border-[#27272a]">
            {(
              [
                { id: 'all', label: 'All Entry Points' },
                { id: 'routes', label: 'Routes & Endpoints' },
                { id: 'middlewares', label: 'Middlewares' },
                { id: 'services', label: 'Services & Handlers' }
              ] as const
            ).map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-2.5 py-1 rounded-[4px] text-[11px] font-mono cursor-pointer transition-colors ${
                  filterType === f.id
                    ? 'bg-[#1f1f22] text-white font-semibold shadow-sm'
                    : 'text-[#919095] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search route path, controller or service..."
              className="w-full bg-[#09090b] border border-[#27272a] rounded-[6px] pl-9 pr-8 py-1.5 text-[12px] font-mono text-white placeholder-[#919095] focus:outline-none focus:border-[#3b82f6] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#919095] hover:text-white"
                title="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Entry Route Selector Carousel / Chips */}
        {filteredEntryPoints.length > 0 ? (
          <div className="pt-2 border-t border-[#27272a]/50">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#919095] block mb-2">
              Select Ingress Trace ({filteredEntryPoints.length})
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {filteredEntryPoints.map(ep => {
                const isSelected = selectedRoute === ep.path;
                return (
                  <button
                    key={ep.path}
                    onClick={() => {
                      setSelectedRoute(ep.path);
                      if (onSelectInvestigationTarget) onSelectInvestigationTarget(ep.path);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-[6px] border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1f1f22] border-[#3b82f6] shadow-[0_0_12px_rgba(59,130,246,0.15)] text-white'
                        : 'bg-[#131316] border-[#27272a] text-[#c8c5ca] hover:border-[#3f3f46] hover:text-white'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-[3px] uppercase ${
                        ep.method === 'POST'
                          ? 'bg-rose-500/20 text-rose-300'
                          : ep.method === 'GET'
                          ? 'bg-blue-500/20 text-blue-300'
                          : ep.method === 'PUT'
                          ? 'bg-amber-500/20 text-amber-300'
                          : ep.method === 'DELETE'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-[#27272a] text-[#919095]'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <div className="flex flex-col max-w-[200px] truncate">
                      <span className="text-[11.5px] font-mono font-semibold truncate">{ep.name}</span>
                      <span className="text-[9px] font-mono text-[#919095] truncate">{ep.path}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-[#919095] text-[12px] font-mono">
            No entry points matched "{searchQuery}". Try a different filter or search term.
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* 2. PRIMARY WORKBENCH: WATERFALL TRACE & SELECTED STEP EVIDENCE            */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER: THE PRIMARY WATERFALL TRACE VISUALIZATION (8 Cols) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-6">
          {traceStages.length === 0 ? (
            <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-12 text-center space-y-3">
              <svg className="w-10 h-10 text-[#919095] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <h3 className="text-[14px] font-bold text-white font-sans">No Execution Trace Available</h3>
              <p className="text-[12px] text-[#919095] max-w-md mx-auto">
                No route execution path could be resolved for the current selection. Pick a different entry point or file
                from the selector above.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {traceStages.map((stage, sIdx) => {
                const isLastStage = sIdx === traceStages.length - 1;
                const stageTheme = ROLE_THEMES[stage.role] || ROLE_THEMES.MODULE;

                return (
                  <div key={stage.stageIndex} className="relative flex flex-col space-y-3">
                    {/* Stage Header Banner */}
                    <div className="flex items-center justify-between bg-[#0e0e11] border border-[#27272a] px-4 py-2 rounded-[6px]">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-mono font-bold text-[#919095] uppercase">
                          Stage 0{stage.stageIndex + 1}
                        </span>
                        <div className="h-3 w-[1px] bg-[#27272a]" />
                        <span className={`text-[11px] font-mono font-bold uppercase ${stageTheme.text}`}>
                          {stage.stageName}
                        </span>
                      </div>
                      {stage.isBranching && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-[4px] border border-amber-500/20">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                          </svg>
                          <span>{stage.steps.length} Parallel Branch Paths</span>
                        </div>
                      )}
                    </div>

                    {/* Stage Steps (With Branching Support) */}
                    <div
                      className={`grid gap-3.5 ${
                        stage.steps.length > 1
                          ? stage.steps.length === 2
                            ? 'grid-cols-1 md:grid-cols-2'
                            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                          : 'grid-cols-1'
                      }`}
                    >
                      {stage.steps.map((step, bIdx) => {
                        const isSelected = activeStep?.id === step.id;
                        const theme = ROLE_THEMES[step.role] || ROLE_THEMES.MODULE;

                        return (
                          <div
                            key={step.id}
                            onClick={() => handleSelectStep(step)}
                            className={`relative group rounded-[8px] p-4 cursor-pointer transition-all border text-left ${
                              isSelected
                                ? 'bg-[#18181b] border-[#3b82f6] shadow-[0_0_20px_rgba(59,130,246,0.18)] ring-1 ring-[#3b82f6]/50'
                                : 'bg-[#0e0e11] border-[#27272a] hover:border-[#3f3f46] hover:bg-[#131316]'
                            }`}
                          >
                            {/* Branch Marker if multiple */}
                            {stage.isBranching && (
                              <div className="flex items-center gap-1 text-[9.5px] font-mono text-[#919095] mb-2 border-b border-[#27272a]/50 pb-1">
                                <span className="text-[#60a5fa] font-bold">Branch #{bIdx + 1}</span>
                                <span>of {stage.steps.length}</span>
                              </div>
                            )}

                            {/* Role Badge + Confidence */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className={`px-2 py-0.5 rounded-[4px] text-[9.5px] font-mono font-bold uppercase border ${theme.bg} ${theme.text} ${theme.border}`}
                              >
                                {theme.label}
                              </span>

                              {step.isCentralityHotspot && (
                                <span className="flex items-center gap-1 text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  <span>🔥 Hotspot</span>
                                </span>
                              )}
                            </div>

                            {/* Symbol Name & File Path */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-mono font-bold text-white group-hover:text-[#60a5fa] transition-colors truncate">
                                  {step.name}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-[#919095] truncate" title={step.filePath}>
                                {step.filePath}
                              </div>
                            </div>

                            {/* Causal Description snippet */}
                            <p className="text-[11.5px] text-[#c8c5ca] mt-2.5 line-clamp-2 leading-relaxed font-sans">
                              {step.description}
                            </p>

                            {/* Grounded Evidence Metadata Pills */}
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-[#27272a]/60 text-[10px] font-mono text-[#919095]">
                              {step.functions.length > 0 && (
                                <span className="flex items-center gap-1 bg-[#131316] px-2 py-0.5 rounded border border-[#27272a]">
                                  <svg className="w-3 h-3 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                  </svg>
                                  {step.functions.length} fns
                                </span>
                              )}
                              {step.exports.length > 0 && (
                                <span className="flex items-center gap-1 bg-[#131316] px-2 py-0.5 rounded border border-[#27272a]">
                                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                  </svg>
                                  {step.exports.length} exports
                                </span>
                              )}
                              {step.lines > 0 && (
                                <span className="flex items-center gap-1 bg-[#131316] px-2 py-0.5 rounded border border-[#27272a]">
                                  {step.lines} lines
                                </span>
                              )}
                            </div>

                            {/* Active Selector Indicator */}
                            {isSelected && (
                              <div className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-[5px] h-8 bg-[#3b82f6] rounded-r shadow-[0_0_8px_#3b82f6]" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Visual Connector Spine / Arrow to Next Stage */}
                    {!isLastStage && (
                      <div className="flex flex-col items-center justify-center my-1 select-none">
                        <div className="w-[2px] h-3 bg-gradient-to-b from-[#3b82f6]/40 to-[#3b82f6]/20" />
                        <div className="w-5 h-5 rounded-full bg-[#131316] border border-[#3b82f6]/50 flex items-center justify-center text-[#3b82f6] shadow-sm">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                          </svg>
                        </div>
                        <div className="w-[2px] h-3 bg-gradient-to-b from-[#3b82f6]/20 to-[#27272a]" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Final Egress Boundary Marker */}
              <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[6px] bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[12px] font-mono font-bold text-white block">Execution Pipeline Exit</span>
                    <span className="text-[10px] font-mono text-[#919095]">
                      Response finalized &amp; returned through protocol egress boundary.
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  HTTP 200 OK / Complete
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT / SIDEBAR: DEEP EVIDENCE & STEP INSPECTOR (4 Cols) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-6">
          {activeStep ? (
            <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] overflow-hidden shadow-lg flex flex-col space-y-5 p-5">
              {/* Header: Stage and Role */}
              <div className="border-b border-[#27272a] pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase tracking-wider">
                    Stage 0{activeStep.stageIndex + 1} &bull; {activeStep.stageName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[4px] text-[9.5px] font-mono font-bold uppercase border ${
                      ROLE_THEMES[activeStep.role]?.bg
                    } ${ROLE_THEMES[activeStep.role]?.text} ${ROLE_THEMES[activeStep.role]?.border}`}
                  >
                    {activeStep.role}
                  </span>
                </div>

                <h2 className="text-[15px] font-mono font-bold text-white truncate" title={activeStep.name}>
                  {activeStep.name}
                </h2>
                <div className="text-[10px] font-mono text-[#919095] truncate" title={activeStep.filePath}>
                  {activeStep.filePath}
                </div>

                {/* File size & lines */}
                <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-[#c8c5ca]">
                  <span>{activeStep.lines} lines</span>
                  <span>&bull;</span>
                  <span>{(activeStep.size / 1024).toFixed(1)} KB</span>
                  <span>&bull;</span>
                  <span className="text-emerald-400">Grounding: {activeStep.confidence}</span>
                </div>
              </div>

              {/* LEVEL 1: Quick Understanding - Why is this in the trace? */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#919095] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  Execution Causal Provenance
                </span>
                <div className="bg-[#131316] border border-[#27272a] rounded-[6px] p-3 text-[11.5px] text-[#c8c5ca] leading-relaxed">
                  {activeStep.confidenceReason}
                </div>
              </div>

              {/* LEVEL 2: Step Investigation - Inbound & Outbound links */}
              <div className="space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#919095] block">
                  Execution Links
                </span>

                {/* Inbound Callers */}
                <div>
                  <span className="text-[9.5px] font-mono text-[#919095] block mb-1">
                    ↳ Called by Upstream ({activeStep.inboundCallers.length})
                  </span>
                  {activeStep.inboundCallers.length > 0 ? (
                    <div className="space-y-1">
                      {activeStep.inboundCallers.map(caller => (
                        <div
                          key={caller}
                          onClick={() => {
                            const target = allTraceSteps.find(s => s.id === caller);
                            if (target) handleSelectStep(target);
                          }}
                          className="text-[10.5px] font-mono text-[#60a5fa] hover:underline cursor-pointer bg-[#131316] px-2.5 py-1 rounded border border-[#27272a] truncate"
                          title="Click to jump to caller"
                        >
                          {caller.split('/').pop() || caller}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-[#919095] italic">Direct entry root</span>
                  )}
                </div>

                {/* Outbound Callees */}
                <div>
                  <span className="text-[9.5px] font-mono text-[#919095] block mb-1">
                    ↳ Dispatches Downstream ({activeStep.outboundCallees.length})
                  </span>
                  {activeStep.outboundCallees.length > 0 ? (
                    <div className="space-y-1">
                      {activeStep.outboundCallees.map(callee => (
                        <div
                          key={callee}
                          onClick={() => {
                            const target = allTraceSteps.find(s => s.id === callee);
                            if (target) handleSelectStep(target);
                          }}
                          className="text-[10.5px] font-mono text-[#60a5fa] hover:underline cursor-pointer bg-[#131316] px-2.5 py-1 rounded border border-[#27272a] truncate"
                          title="Click to jump to callee"
                        >
                          {callee.split('/').pop() || callee}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-[#919095] italic">No further downstream calls</span>
                  )}
                </div>
              </div>

              {/* LEVEL 3: Deep AST Grounded Evidence */}
              <div className="space-y-3 pt-2 border-t border-[#27272a]/60">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#919095] block">
                  AST Grounded Evidence
                </span>

                {/* Functions */}
                {activeStep.functions.length > 0 && (
                  <div>
                    <span className="text-[9.5px] font-mono text-[#919095] block mb-1">
                      Functions Declared ({activeStep.functions.length})
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                      {activeStep.functions.map(fn => (
                        <span
                          key={fn}
                          className="px-2 py-0.5 rounded-[4px] bg-[#131316] text-[#c8c5ca] border border-[#27272a] text-[9.5px] font-mono"
                        >
                          {fn}()
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exports */}
                {activeStep.exports.length > 0 && (
                  <div>
                    <span className="text-[9.5px] font-mono text-[#919095] block mb-1">
                      Exported Symbols ({activeStep.exports.length})
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 scrollbar-thin">
                      {activeStep.exports.map(exp => (
                        <span
                          key={exp}
                          className="px-2 py-0.5 rounded-[4px] bg-[#131316] text-[#c8c5ca] border border-[#27272a] text-[9.5px] font-mono"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classes */}
                {activeStep.classes.length > 0 && (
                  <div>
                    <span className="text-[9.5px] font-mono text-[#919095] block mb-1">
                      Classes ({activeStep.classes.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {activeStep.classes.map(cls => (
                        <span
                          key={cls}
                          className="px-2 py-0.5 rounded-[4px] bg-[#131316] text-[#c8c5ca] border border-[#27272a] text-[9.5px] font-mono"
                        >
                          class {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cross-Workspace Action Buttons */}
              <div className="space-y-2 pt-4 border-t border-[#27272a]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#919095] block mb-1">
                  Investigation Actions
                </span>

                <button
                  onClick={() => onNavigateToExplorer(activeStep.filePath)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] bg-[#1f1f22] hover:bg-[#27272a] text-white border border-[#27272a] text-[11px] font-mono cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
                    </svg>
                    Inspect in Explorer
                  </span>
                  <svg className="w-3.5 h-3.5 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                {onNavigateToGraph && (
                  <button
                    onClick={() => onNavigateToGraph(activeStep.filePath)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] bg-[#131316] hover:bg-[#1f1f22] text-[#c8c5ca] hover:text-white border border-[#27272a] text-[11px] font-mono cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#a855f7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                      </svg>
                      View in Architecture Graph
                    </span>
                    <svg className="w-3.5 h-3.5 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                )}

                {onNavigateToImpact && (
                  <button
                    onClick={() => onNavigateToImpact(activeStep.filePath)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] bg-[#131316] hover:bg-[#1f1f22] text-[#c8c5ca] hover:text-white border border-[#27272a] text-[11px] font-mono cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                      Analyze Blast Radius Impact
                    </span>
                    <svg className="w-3.5 h-3.5 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={() => onTriggerChatQuery(getAIQuery('explain'))}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[11px] font-mono font-semibold cursor-pointer transition-colors mt-2 shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Ask Archon AI About Step
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#0e0e11] border border-[#27272a] rounded-[8px] p-6 text-center text-[#919095] text-[12px] font-mono">
              Click any execution step in the trace to inspect its causal evidence, AST functions, and callers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
