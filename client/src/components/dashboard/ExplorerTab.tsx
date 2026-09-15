import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ExplorerTabProps, FileItem, FileIntelligence, InsightsData, ArchitecturalRole } from './explorer/explorerTypes';
import {
  detectArchitecturalRole,
  getParentDirectoryPaths,
  buildFileTree,
  detectLanguage
} from './explorer/explorerUtils';
import ExplorerFileTree from './explorer/ExplorerFileTree';
import ExplorerCodeViewer from './explorer/ExplorerCodeViewer';
import ExplorerIntelligencePanel from './explorer/ExplorerIntelligencePanel';
import api from '../../lib/api';

export default function ExplorerTab({
  files,
  selectedFiles,
  onToggleFile,
  onToggleFolder,
  repositoryId,
  astMetadata,
  dependencyGraph,
  selectedExplorerFile,
  setSelectedExplorerFile,
  investigationTarget,
  onSelectInvestigationTarget,
  entryPoints = [],
  framework,
  onNavigateToGraph,
  onNavigateToImpact,
  onNavigateToTrace,
  onTriggerChat
}: ExplorerTabProps) {
  // Active selected file in Explorer
  const currentTarget = selectedExplorerFile || investigationTarget || (files.length > 0 ? files[0].path : null);
  const [activeFile, setActiveFile] = useState<string | null>(currentTarget);

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    if (currentTarget) {
      return new Set(getParentDirectoryPaths(currentTarget));
    }
    return new Set(['']);
  });

  // Mobile/Tablet responsive view mode: 'tree' | 'code' | 'intel'
  const [mobileTab, setMobileTab] = useState<'tree' | 'code' | 'intel'>('code');

  // Toggle state for Right Intelligence Panel on desktop
  const [showIntelligencePanel, setShowIntelligencePanel] = useState(true);

  // Backend Insights state (drift, cycles, hotspots, missing tests)
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Fetch backend insights on mount
  useEffect(() => {
    let isMounted = true;
    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const { data } = await api.get(`/repos/${repositoryId}/insights`);
        if (isMounted) {
          setInsights(data.data);
        }
      } catch (err) {
        console.warn('Could not fetch repo insights in explorer:', err);
      } finally {
        if (isMounted) setLoadingInsights(false);
      }
    };
    fetchInsights();
    return () => {
      isMounted = false;
    };
  }, [repositoryId]);

  // Sync when selectedExplorerFile or investigationTarget changes from external actions (e.g. Overview finding click)
  useEffect(() => {
    const target = selectedExplorerFile || investigationTarget;
    if (target && target !== activeFile) {
      setActiveFile(target);
      // Auto-expand all parent folders
      const parents = getParentDirectoryPaths(target);
      setExpandedFolders(prev => {
        const next = new Set(prev);
        parents.forEach(p => next.add(p));
        return next;
      });
    }
  }, [selectedExplorerFile, investigationTarget]);

  // Handle file selection within Explorer
  const handleSelectFile = useCallback((filePath: string) => {
    setActiveFile(filePath);
    setSelectedExplorerFile(filePath);
    if (onSelectInvestigationTarget) {
      onSelectInvestigationTarget(filePath);
    }
    // Auto-expand parent folders
    const parents = getParentDirectoryPaths(filePath);
    setExpandedFolders(prev => {
      const next = new Set(prev);
      parents.forEach(p => next.add(p));
      return next;
    });
    // On mobile switch to code view
    setMobileTab('code');
  }, [setSelectedExplorerFile, onSelectInvestigationTarget]);

  // Toggle folder expand
  const handleToggleFolderExpand = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  // Expand all folders
  const handleExpandAll = useCallback(() => {
    const allFolders = new Set<string>(['']);
    if (Array.isArray(files)) {
      files.forEach(f => {
        if (f && f.path) {
          const parents = getParentDirectoryPaths(f.path);
          parents.forEach(p => allFolders.add(p));
        }
      });
    }
    setExpandedFolders(allFolders);
  }, [files]);

  // Collapse all folders except root
  const handleCollapseAll = useCallback(() => {
    setExpandedFolders(new Set(['']));
  }, []);

  // Compute reverse dependency graph (dependents: who imports this file?)
  const dependentsMap = useMemo<Record<string, string[]>>(() => {
    const rev: Record<string, string[]> = {};
    if (Array.isArray(files)) {
      files.forEach(f => {
        if (f && f.path) rev[f.path] = [];
      });
    }

    if (dependencyGraph && typeof dependencyGraph === 'object') {
      for (const [source, imports] of Object.entries(dependencyGraph)) {
        if (Array.isArray(imports)) {
          imports.forEach(imp => {
            if (typeof imp === 'string') {
              const normImp = imp.replace(/\\/g, '/');
              if (!rev[normImp]) rev[normImp] = [];
              const normSource = source.replace(/\\/g, '/');
              if (!rev[normImp].includes(normSource)) {
                rev[normImp].push(normSource);
              }
            }
          });
        }
      }
    }
    return rev;
  }, [files, dependencyGraph]);

  // Compute architectural roles for all files
  const rolesMap = useMemo<Record<string, ArchitecturalRole>>(() => {
    const map: Record<string, ArchitecturalRole> = {};
    if (Array.isArray(files)) {
      files.forEach(f => {
        if (f && f.path) {
          map[f.path] = detectArchitecturalRole(f.path, astMetadata?.[f.path], entryPoints);
        }
      });
    }
    return map;
  }, [files, astMetadata, entryPoints]);

  // Warnings and Hotspots maps
  const warningsMap = useMemo<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (insights?.architecturalDrift) {
      insights.architecturalDrift.forEach(d => {
        map[d.filePath] = true;
        map[d.targetPath] = true;
      });
    }
    if (insights?.circularDependencies) {
      insights.circularDependencies.forEach(cycle => {
        cycle.forEach(f => {
          map[f] = true;
        });
      });
    }
    return map;
  }, [insights]);

  const hotspotsMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (insights?.centralityHotspots) {
      insights.centralityHotspots.forEach(h => {
        map[h.filePath] = h.inDegree;
      });
    } else {
      // Fallback to local reverse dependents count
      Object.entries(dependentsMap).forEach(([p, deps]) => {
        if (deps.length > 0) map[p] = deps.length;
      });
    }
    return map;
  }, [insights, dependentsMap]);

  // Build the hierarchical tree
  const fileTree = useMemo(() => {
    return buildFileTree(files, rolesMap, warningsMap, hotspotsMap);
  }, [files, rolesMap, warningsMap, hotspotsMap]);

  // Selected file item
  const activeFileItem = useMemo<FileItem | null>(() => {
    if (!activeFile) return null;
    return files.find(f => f.path === activeFile) || {
      path: activeFile,
      size: 0,
      lines: 0
    };
  }, [activeFile, files]);

  // File Intelligence model
  const activeIntelligence = useMemo<FileIntelligence | null>(() => {
    if (!activeFileItem) return null;

    const path = activeFileItem.path;
    const name = path.split('/').pop() || '';
    const role = rolesMap[path] || 'MODULE';
    const isEntryPoint = entryPoints.includes(path);
    const inDegree = hotspotsMap[path] || dependentsMap[path]?.length || 0;
    const outboundDependencies = dependencyGraph?.[path] || [];
    const inboundDependents = dependentsMap[path] || [];

    const driftViolations = insights?.architecturalDrift?.filter(
      d => d.filePath === path || d.targetPath === path
    ) || [];

    const cycleInvolvement = insights?.circularDependencies?.filter(
      cycle => cycle.includes(path)
    ) || [];

    const isMissingTest = !!insights?.missingTests?.includes(path);
    const isDeadCode = !!insights?.deadCode?.includes(path);

    const ast = astMetadata?.[path];
    const astInfo = ast
      ? {
          classes: ast.classes || [],
          functions: ast.functions || [],
          imports: ast.imports || [],
          exports: ast.exports || []
        }
      : undefined;

    return {
      path,
      name,
      size: activeFileItem.size,
      lines: activeFileItem.lines,
      content: activeFileItem.content,
      language: detectLanguage(path),
      role,
      isEntryPoint,
      inDegree,
      outboundDependencies,
      inboundDependents,
      driftViolations,
      cycleInvolvement,
      isMissingTest,
      isDeadCode,
      astInfo
    };
  }, [activeFileItem, rolesMap, entryPoints, hotspotsMap, dependentsMap, dependencyGraph, insights, astMetadata]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#09090b] overflow-hidden">
      {/* MOBILE / TABLET TAB SELECTOR (Hidden on lg+ desktop) */}
      <div className="lg:hidden flex items-center border-b border-zinc-800 bg-[#0e0e11] px-3 py-2 shrink-0">
        <div className="flex rounded bg-zinc-900 p-0.5 border border-zinc-800 text-[12px] font-mono w-full">
          <button
            onClick={() => setMobileTab('tree')}
            className={`flex-1 py-1 text-center rounded cursor-pointer ${
              mobileTab === 'tree' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400'
            }`}
          >
            File Tree ({files.length})
          </button>
          <button
            onClick={() => setMobileTab('code')}
            className={`flex-1 py-1 text-center rounded cursor-pointer ${
              mobileTab === 'code' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400'
            }`}
          >
            Code View
          </button>
          <button
            onClick={() => setMobileTab('intel')}
            className={`flex-1 py-1 text-center rounded cursor-pointer ${
              mobileTab === 'intel' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400'
            }`}
          >
            Intelligence
          </button>
        </div>
      </div>

      {/* WORKSPACE MAIN BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN 1: FILE TREE (Visible on desktop or when mobileTab === 'tree') */}
        <div
          className={`w-full lg:w-[280px] xl:w-[310px] shrink-0 h-full ${
            mobileTab === 'tree' ? 'block' : 'hidden lg:block'
          }`}
        >
          <ExplorerFileTree
            tree={fileTree}
            files={files}
            selectedFile={activeFile}
            onSelectFile={handleSelectFile}
            selectedScopeFiles={selectedFiles}
            onToggleScopeFile={onToggleFile}
            onToggleScopeFolder={onToggleFolder}
            expandedFolders={expandedFolders}
            onToggleFolderExpand={handleToggleFolderExpand}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
            rolesMap={rolesMap}
            warningsMap={warningsMap}
            hotspotsMap={hotspotsMap}
          />
        </div>

        {/* COLUMN 2: CODE / FILE VIEWER (Visible on desktop or when mobileTab === 'code') */}
        <div
          className={`flex-1 h-full min-w-0 flex flex-col ${
            mobileTab === 'code' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {activeFileItem && activeIntelligence ? (
            <ExplorerCodeViewer
              file={activeFileItem}
              role={activeIntelligence.role}
              driftViolations={activeIntelligence.driftViolations}
              cycleInvolvement={activeIntelligence.cycleInvolvement}
              inDegree={activeIntelligence.inDegree}
              isMissingTest={activeIntelligence.isMissingTest}
              isDeadCode={activeIntelligence.isDeadCode}
              onNavigateToGraph={onNavigateToGraph}
              onNavigateToImpact={onNavigateToImpact}
              onNavigateToTrace={onNavigateToTrace}
              onTriggerChat={onTriggerChat}
              onSelectFile={handleSelectFile}
              onToggleScope={() => onToggleFile(activeFileItem.path)}
              isScopeSelected={selectedFiles.has(activeFileItem.path)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-2">
              <svg className="w-12 h-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
              </svg>
              <p className="text-zinc-300 font-medium">Select a file to inspect</p>
              <p className="text-[12px] text-zinc-500">
                Choose any file from the repository tree on the left to reveal its code and architectural intelligence.
              </p>
            </div>
          )}
        </div>

        {/* COLUMN 3: ARCHITECTURAL INTELLIGENCE PANEL (Visible on desktop or when mobileTab === 'intel') */}
        {activeIntelligence && (
          <div
            className={`w-full lg:w-[320px] xl:w-[350px] shrink-0 h-full ${
              mobileTab === 'intel'
                ? 'block'
                : showIntelligencePanel
                ? 'hidden lg:block'
                : 'hidden'
            }`}
          >
            <ExplorerIntelligencePanel
              intelligence={activeIntelligence}
              onSelectFile={handleSelectFile}
              onNavigateToGraph={onNavigateToGraph}
              onNavigateToImpact={onNavigateToImpact}
              onNavigateToTrace={onNavigateToTrace}
              onTriggerChat={onTriggerChat}
              onClose={() => setShowIntelligencePanel(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
