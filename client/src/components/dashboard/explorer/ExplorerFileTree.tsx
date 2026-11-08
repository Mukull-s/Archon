import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TreeNode, FileItem, ArchitecturalRole } from './explorerTypes';

interface ExplorerFileTreeProps {
  tree: TreeNode;
  files: FileItem[];
  selectedFile: string | null;
  onSelectFile: (filePath: string) => void;
  selectedScopeFiles: Set<string>;
  onToggleScopeFile: (filePath: string) => void;
  onToggleScopeFolder: (folderPath: string, checked: boolean) => void;
  expandedFolders: Set<string>;
  onToggleFolderExpand: (folderPath: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  rolesMap: Record<string, ArchitecturalRole>;
  warningsMap: Record<string, boolean>;
  hotspotsMap: Record<string, number>;
}

// Two-letter extension badge used inside the tree row's `.ic` slot.
const fileBadge = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!ext || ext === name.toLowerCase()) return '·';
  return ext.slice(0, 2);
};

// Leading label for the role badge, mirroring the tree's abbreviation rule.
const roleAbbrev = (role: ArchitecturalRole): string =>
  role === 'ENTRY POINT' ? 'entry' : role.slice(0, 4).toLowerCase();

export default function ExplorerFileTree({
  tree,
  files,
  selectedFile,
  onSelectFile,
  selectedScopeFiles,
  onToggleScopeFile,
  onToggleScopeFolder,
  expandedFolders,
  onToggleFolderExpand,
  onExpandAll,
  onCollapseAll,
  rolesMap,
  warningsMap,
  hotspotsMap
}: ExplorerFileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState<string>('ALL');
  const selectedNodeRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll selected file into view when it changes
  useEffect(() => {
    if (selectedFile && selectedNodeRef.current) {
      selectedNodeRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedFile]);

  // Compute folder selection state (all children checked, partial, or none)
  const isFolderSelected = (folderNode: TreeNode): boolean => {
    let allSelected = true;
    const checkRecursive = (node: TreeNode) => {
      if (!node.isDirectory) {
        if (!selectedScopeFiles.has(node.path)) allSelected = false;
      } else {
        Object.values(node.children).forEach(checkRecursive);
      }
    };
    checkRecursive(folderNode);
    return allSelected;
  };

  const isFolderPartiallySelected = (folderNode: TreeNode): boolean => {
    let hasSelected = false;
    let hasUnselected = false;
    const checkRecursive = (node: TreeNode) => {
      if (!node.isDirectory) {
        if (selectedScopeFiles.has(node.path)) hasSelected = true;
        else hasUnselected = true;
      } else {
        Object.values(node.children).forEach(checkRecursive);
      }
    };
    checkRecursive(folderNode);
    return hasSelected && hasUnselected;
  };

  // Filtered files matching search or role filter
  const filteredPaths = useMemo(() => {
    if (!searchQuery.trim() && activeRoleFilter === 'ALL') return null;

    const lowerQuery = searchQuery.toLowerCase().trim();
    return new Set(
      files
        .filter(f => {
          const matchesQuery = !lowerQuery || f.path.toLowerCase().includes(lowerQuery);
          if (!matchesQuery) return false;

          if (activeRoleFilter === 'ALL') return true;
          if (activeRoleFilter === 'WARNINGS') return !!warningsMap[f.path];
          if (activeRoleFilter === 'HOTSPOTS') return (hotspotsMap[f.path] || 0) > 0;
          return rolesMap[f.path] === activeRoleFilter;
        })
        .map(f => f.path)
    );
  }, [files, searchQuery, activeRoleFilter, rolesMap, warningsMap, hotspotsMap]);

  // Node filter checker
  const isNodeVisible = (node: TreeNode): boolean => {
    if (!filteredPaths) return true;
    if (!node.isDirectory) return filteredPaths.has(node.path);

    // Directory is visible if any child is visible
    return Object.values(node.children).some(isNodeVisible);
  };

  // Recursive tree renderer
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    if (!isNodeVisible(node)) return null;

    if (node.path === '') {
      return (
        <div className="flex flex-col gap-0.5">
          {Object.values(node.children).map(child => renderTreeNode(child, depth))}
        </div>
      );
    }

    const isExpanded = expandedFolders.has(node.path) || !!searchQuery.trim();
    const isSelected = selectedFile === node.path;
    const role = rolesMap[node.path];
    const hasWarning = warningsMap[node.path];
    const hotspotCount = hotspotsMap[node.path];

    const isFolderChecked = node.isDirectory ? isFolderSelected(node) : selectedScopeFiles.has(node.path);
    const isFolderPartial = node.isDirectory ? isFolderPartiallySelected(node) : false;

    return (
      <div key={node.path} className="flex flex-col">
        <div
          ref={isSelected ? selectedNodeRef : null}
          onClick={() => {
            if (node.isDirectory) {
              onToggleFolderExpand(node.path);
            } else {
              onSelectFile(node.path);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`tnode ${node.isDirectory ? '' : 'is-file'} ${isSelected ? 'is-on' : ''}`}
          role="treeitem"
          aria-expanded={node.isDirectory ? isExpanded : undefined}
          aria-selected={isSelected}
          title={node.path}
        >
          {/* Twist / chevron */}
          <span
            className="tw"
            onClick={(e) => {
              e.stopPropagation();
              if (node.isDirectory) onToggleFolderExpand(node.path);
            }}
          >
            {node.isDirectory ? (isExpanded ? '▾' : '▸') : ''}
          </span>

          {/* Scope selection checkbox for AI assistant scope */}
          <input
            type="checkbox"
            checked={isFolderChecked}
            ref={el => {
              if (el) el.indeterminate = isFolderPartial;
            }}
            onChange={(e) => {
              e.stopPropagation();
              if (node.isDirectory) {
                onToggleScopeFolder(node.path, e.target.checked);
              } else {
                onToggleScopeFile(node.path);
              }
            }}
            title="Include in AI Assistant Context Scope"
            className="h-3 w-3 shrink-0 cursor-pointer rounded-[2px] border-rule-strong bg-paper accent-forest opacity-40 transition-opacity group-hover:opacity-100"
          />

          {/* File-type badge / folder mark */}
          <span className="ic">{node.isDirectory ? '/' : fileBadge(node.name)}</span>

          {/* Node name */}
          <span className="nm">{node.name}</span>

          {/* Indicators: hotspots / warnings / role */}
          <span className="meta flex items-center gap-1.5">
            {hotspotCount && hotspotCount > 0 ? (
              <span
                className="deg font-mono"
                title={`${hotspotCount} incoming callers`}
              >
                {hotspotCount}
              </span>
            ) : null}

            {hasWarning && (
              <span className="st st--risk h-2 w-2 rounded-full bg-sig" title="Architectural warning or drift detected" />
            )}

            {!node.isDirectory && role && role !== 'MODULE' && (
              <span
                className="rounded-[2px] border border-rule bg-paper-3 px-1 py-px font-mono text-[8.5px] uppercase tracking-[.1em] text-ink-3"
                title={role}
              >
                {roleAbbrev(role)}
              </span>
            )}
          </span>
        </div>

        {/* Child nodes */}
        {node.isDirectory && isExpanded && (
          <div className="flex flex-col">
            {Object.values(node.children).map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col border-r border-rule bg-paper-2 select-none">
      {/* Search header */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-rule p-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files (path, name)..."
            className="w-full rounded-[3px] border border-rule-strong bg-paper py-1.5 pl-8 pr-2.5 font-mono text-[11.5px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-ink-3 hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick filter row */}
        <div className="flex items-center justify-between font-mono text-[10px] text-ink-2">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {['ALL', 'HOTSPOTS', 'WARNINGS', 'CONTROLLER', 'SERVICE', 'ROUTE'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveRoleFilter(filter)}
                className={`shrink-0 cursor-pointer rounded-[2px] border px-1.5 py-0.5 text-[9px] uppercase tracking-[.1em] transition-colors ${
                  activeRoleFilter === filter
                    ? 'border-forest bg-forest/10 font-semibold text-emerald'
                    : 'border-transparent text-ink-3 hover:border-rule hover:bg-paper-3 hover:text-ink'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter === 'HOTSPOTS' ? 'Hot' : filter === 'WARNINGS' ? 'Warn' : filter.slice(0, 4)}
              </button>
            ))}
          </div>

          {/* Tree expand/collapse controls */}
          <div className="ml-1 flex shrink-0 items-center gap-1">
            <button
              onClick={onCollapseAll}
              className="cursor-pointer rounded-[2px] p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
              title="Collapse all folders"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onExpandAll}
              className="cursor-pointer rounded-[2px] p-1 text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
              title="Expand all folders"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tree view container */}
      <div className="tree flex-1 overflow-y-auto p-2" role="tree">
        {renderTreeNode(tree)}
      </div>

      {/* Scope footer status */}
      <div className="flex shrink-0 items-center justify-between border-t border-rule bg-paper-3 p-2.5 font-mono text-[10px] text-ink-2">
        <span>{selectedScopeFiles.size} / {files.length} indexed</span>
        <button
          onClick={() => {
            if (selectedScopeFiles.size === files.length) {
              files.forEach(f => onToggleScopeFile(f.path));
            } else {
              files.forEach(f => {
                if (!selectedScopeFiles.has(f.path)) onToggleScopeFile(f.path);
              });
            }
          }}
          className="cursor-pointer text-emerald hover:underline"
        >
          {selectedScopeFiles.size === files.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  );
}
