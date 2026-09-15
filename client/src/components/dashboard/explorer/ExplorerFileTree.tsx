import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TreeNode, FileItem, ArchitecturalRole } from './explorerTypes';
import { getRoleBadgeStyle } from './explorerUtils';

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

// Visual File Icon based on extension
const FileIcon = ({ name, role }: { name: string; role?: ArchitecturalRole }) => {
  const ext = name.split('.').pop()?.toLowerCase();
  let color = 'text-zinc-400';

  if (role === 'ENTRY POINT') color = 'text-emerald-400';
  else if (role === 'CONTROLLER') color = 'text-indigo-400';
  else if (role === 'SERVICE') color = 'text-purple-400';
  else if (role === 'ROUTE') color = 'text-blue-400';
  else if (role === 'MODEL') color = 'text-amber-400';
  else if (ext === 'ts' || ext === 'tsx') color = 'text-blue-400';
  else if (ext === 'js' || ext === 'jsx') color = 'text-yellow-400';
  else if (ext === 'json') color = 'text-orange-400';
  else if (ext === 'css' || ext === 'scss') color = 'text-pink-400';
  else if (ext === 'md') color = 'text-emerald-400';

  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

// Folder Icon
const FolderIcon = ({ expanded }: { expanded: boolean }) => (
  <svg className={`w-4 h-4 shrink-0 ${expanded ? 'text-blue-400' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

// Chevron Icon
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform duration-150 ${expanded ? 'rotate-90 text-zinc-300' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

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
    const roleStyle = role ? getRoleBadgeStyle(role) : null;
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
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center gap-2 py-1.5 pr-2 rounded-[4px] cursor-pointer group transition-colors select-none text-[12.5px] font-mono relative ${
            isSelected
              ? 'bg-[#18181b] text-white border-l-2 border-primary font-semibold shadow-sm'
              : 'hover:bg-[#18181b]/60 text-zinc-400 hover:text-zinc-200'
          }`}
          role="treeitem"
          aria-expanded={node.isDirectory ? isExpanded : undefined}
          aria-selected={isSelected}
          title={node.path}
        >
          {/* Chevron */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (node.isDirectory) onToggleFolderExpand(node.path);
            }}
            className="w-4 h-4 flex items-center justify-center shrink-0 cursor-pointer hover:bg-zinc-800 rounded"
          >
            {node.isDirectory && <ChevronIcon expanded={isExpanded} />}
          </div>

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
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-0 cursor-pointer shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
          />

          {/* Icon */}
          {node.isDirectory ? (
            <FolderIcon expanded={isExpanded} />
          ) : (
            <FileIcon name={node.name} role={role} />
          )}

          {/* Node Name */}
          <span className="truncate flex-1">
            {node.name}
          </span>

          {/* Indicators: Hotspots / Warnings / Role */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {hotspotCount && hotspotCount > 0 && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                title={`${hotspotCount} incoming callers`}
              >
                ★ {hotspotCount}
              </span>
            )}

            {hasWarning && (
              <span
                className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0"
                title="Architectural warning or drift detected"
              />
            )}

            {!node.isDirectory && role && role !== 'MODULE' && (
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase tracking-wider hidden group-hover:inline-block ${
                  roleStyle ? `${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}` : 'text-zinc-500'
                }`}
              >
                {role === 'ENTRY POINT' ? 'ENTRY' : role.slice(0, 4)}
              </span>
            )}
          </div>
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
    <div className="h-full flex flex-col bg-[#0b0b0e] border-r border-zinc-800/80 select-none">
      {/* Search Header */}
      <div className="p-3 border-b border-zinc-800/80 space-y-2.5 flex-shrink-0">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files (path, name)..."
            className="w-full bg-[#141418] border border-zinc-800 rounded px-2.5 py-1.5 pl-8 text-[12px] font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-primary/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Quick Filter Row */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            {['ALL', 'HOTSPOTS', 'WARNINGS', 'CONTROLLER', 'SERVICE', 'ROUTE'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveRoleFilter(filter)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                  activeRoleFilter === filter
                    ? 'bg-primary/20 text-primary border border-primary/40 font-semibold'
                    : 'hover:bg-zinc-800 text-zinc-400'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter === 'HOTSPOTS' ? 'Hot' : filter === 'WARNINGS' ? 'Warn' : filter.slice(0, 4)}
              </button>
            ))}
          </div>

          {/* Tree expand/collapse controls */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              onClick={onCollapseAll}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
              title="Collapse all folders"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onExpandAll}
              className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded"
              title="Expand all folders"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tree View Container */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800" role="tree">
        {renderTreeNode(tree)}
      </div>

      {/* Scope Footer Status */}
      <div className="p-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400 bg-[#09090b]">
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
          className="text-primary hover:underline cursor-pointer"
        >
          {selectedScopeFiles.size === files.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
    </div>
  );
}
