import React, { useState, useMemo, useEffect, useRef } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';

interface FileItem {
  path: string;
  size: number;
  lines: number;
}

interface ScopeSelectorProps {
  files: FileItem[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleFolder: (folderPath: string, checked: boolean) => void;
  repositoryId: string;
  astMetadata: any;
  dependencyGraph: any;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children: Record<string, TreeNode>;
}

// Modern SVGs matching the Stitch design language
const FolderIcon = () => (
  <svg className="w-4 h-4 shrink-0 text-blue-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const FileIcon = ({ name }: { name: string }) => {
  const ext = name.split('.').pop()?.toLowerCase();
  let color = 'text-[#c8c5ca]/50';
  
  if (ext === 'ts' || ext === 'tsx') color = 'text-[#60a5fa]';
  else if (ext === 'js' || ext === 'jsx') color = 'text-[#fcd34d]';
  else if (ext === 'json') color = 'text-[#fb923c]';
  else if (ext === 'css' || ext === 'scss') color = 'text-[#f472b6]';
  else if (ext === 'md' || ext === 'txt') color = 'text-[#34d399]';
  else if (ext === 'yaml' || ext === 'yml') color = 'text-[#a78bfa]';

  return (
    <svg className={`w-4 h-4 shrink-0 ${color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`w-3.5 h-3.5 shrink-0 text-[#919095] transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

interface RecentViewItem {
  path: string;
  timestamp: number;
}

export default function ScopeSelector({
  files,
  selectedFiles,
  onToggleFile,
  onToggleFolder,
  repositoryId,
  astMetadata,
  dependencyGraph,
}: ScopeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  // LocalStorage state trackers
  const [recentlyViewed, setRecentlyViewed] = useState<RecentViewItem[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<string[]>([]);
  
  // Context / Overflow menu state
  const [activeMenuFile, setActiveMenuFile] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Insights recommendations state
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  // Load localStorage history
  useEffect(() => {
    try {
      const recentKey = `archon_recent_${repositoryId}`;
      const pinnedKey = `archon_pinned_${repositoryId}`;
      
      const storedRecent = localStorage.getItem(recentKey);
      if (storedRecent) setRecentlyViewed(JSON.parse(storedRecent));

      const storedPinned = localStorage.getItem(pinnedKey);
      if (storedPinned) setPinnedFiles(JSON.parse(storedPinned));
    } catch (e) {
      console.error('Failed to load storage details:', e);
    }
  }, [repositoryId]);

  // Fetch backend insights on mount
  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const { data } = await api.get(`/repos/${repositoryId}/insights`);
        setInsights(data.data);
      } catch (err) {
        console.error('Failed to fetch insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    };
    fetchInsights();
  }, [repositoryId]);

  // Handle outside click to close context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuFile(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Update Recently Viewed history
  const trackFileView = (filePath: string) => {
    setSelectedFile(filePath);
    const recentKey = `archon_recent_${repositoryId}`;
    
    setRecentlyViewed(prev => {
      const filtered = prev.filter(item => item.path !== filePath);
      const updated = [{ path: filePath, timestamp: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem(recentKey, JSON.stringify(updated));
      return updated;
    });
  };

  // Toggle pin
  const togglePinFile = (filePath: string) => {
    const pinnedKey = `archon_pinned_${repositoryId}`;
    setPinnedFiles(prev => {
      const updated = prev.includes(filePath)
        ? prev.filter(p => p !== filePath)
        : [...prev, filePath];
      localStorage.setItem(pinnedKey, JSON.stringify(updated));
      toast.success(prev.includes(filePath) ? `Unpinned ${filePath}` : `Pinned ${filePath}`);
      return updated;
    });
  };

  // Copy Path to Clipboard
  const handleCopyPath = (filePath: string) => {
    navigator.clipboard.writeText(filePath);
    toast.success(`Copied path: ${filePath}`);
  };

  // Relative Time Formatter
  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Filtered files list
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(f => f.path.toLowerCase().includes(query));
  }, [files, searchQuery]);

  // Re-build tree root matching filtered paths
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      path: '',
      isDirectory: true,
      size: 0,
      children: {},
    };

    for (const file of filteredFiles) {
      const parts = file.path.split('/');
      let current = root;
      let cumulativePath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        cumulativePath = cumulativePath ? `${cumulativePath}/${part}` : part;
        const isLast = i === parts.length - 1;

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: cumulativePath,
            isDirectory: !isLast,
            size: isLast ? file.size : 0,
            children: {},
          };
        }

        current = current.children[part];
        if (!isLast) {
          current.size += file.size;
        }
      }
    }

    return root;
  }, [filteredFiles]);

  // Auto-expand paths when query filters tree
  useEffect(() => {
    if (searchQuery) {
      const paths = new Set<string>();
      filteredFiles.forEach(f => {
        const parts = f.path.split('/');
        let current = '';
        for (let i = 0; i < parts.length - 1; i++) {
          current = current ? `${current}/${parts[i]}` : parts[i];
          paths.add(current);
        }
      });
      setExpandedFolders(paths);
    }
  }, [searchQuery, filteredFiles]);

  // Helper functions for folders toggle checked state
  const getFilesInFolder = (node: TreeNode): string[] => {
    const result: string[] = [];
    const traverse = (n: TreeNode) => {
      if (!n.isDirectory) {
        result.push(n.path);
      } else {
        Object.values(n.children).forEach(traverse);
      }
    };
    traverse(node);
    return result;
  };

  const isFolderSelected = (node: TreeNode): boolean => {
    const folderFiles = getFilesInFolder(node);
    if (folderFiles.length === 0) return false;
    return folderFiles.every(f => selectedFiles.has(f));
  };

  const isFolderPartiallySelected = (node: TreeNode): boolean => {
    const folderFiles = getFilesInFolder(node);
    const count = folderFiles.filter(f => selectedFiles.has(f)).length;
    return count > 0 && count < folderFiles.length;
  };

  const handleFolderCheckboxChange = (node: TreeNode) => {
    const allSelected = isFolderSelected(node);
    onToggleFolder(node.path, !allSelected);
  };

  const toggleFolderExpand = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Dynamic recommendations mapping
  const recommendations = useMemo(() => {
    if (!insights) return [];
    const items: Array<{ type: 'refactor' | 'perf' | 'critical'; title: string; desc: string; linkText: string; action: () => void }> = [];

    // Circular Dependency Recommendation
    if (insights.circularDependencies && insights.circularDependencies.length > 0) {
      const cycle = insights.circularDependencies[0];
      const primaryFile = cycle[0] || 'StateReducer.ts';
      items.push({
        type: 'critical',
        title: `Audit the '${primaryFile.split('/').pop()}' Context`,
        desc: `Archon detected ${insights.circularDependencies.length} circular dependency cycles. Auditing this orchestration logic will clean up structural coupling.`,
        linkText: 'Open Details',
        action: () => trackFileView(primaryFile)
      });
    }

    // Dead Code Recommendation
    if (insights.deadCode && insights.deadCode.length > 0) {
      const deadFile = insights.deadCode[0];
      items.push({
        type: 'refactor',
        title: 'Legacy Cleanup Opportunity',
        desc: `The analysis marked '${deadFile.split('/').pop()}' and ${insights.deadCode.length - 1} other modules as dead code no longer referenced anywhere in the app.`,
        linkText: 'Inspect Module',
        action: () => trackFileView(deadFile)
      });
    }

    // Missing Tests Recommendation
    if (insights.missingTests && insights.missingTests.length > 0) {
      const testGapFile = insights.missingTests[0];
      items.push({
        type: 'perf',
        title: 'Expand Coverage Gap',
        desc: `File '${testGapFile.split('/').pop()}' lacks associated unit tests. Writing tests here will safeguard logic from regressions.`,
        linkText: 'Examine File',
        action: () => trackFileView(testGapFile)
      });
    }

    return items;
  }, [insights]);

  // Dynamic Module Groups
  const moduleGroups = useMemo(() => {
    const groups: Record<string, { size: number; filePaths: string[] }> = {};
    files.forEach(f => {
      const parts = f.path.split('/');
      const groupName = parts.length > 1 ? parts[0] : 'root';
      if (!groups[groupName]) {
        groups[groupName] = { size: 0, filePaths: [] };
      }
      groups[groupName].size += f.size;
      groups[groupName].filePaths.push(f.path);
    });

    return Object.entries(groups).map(([name, data]) => {
      // Calculate coverage dynamically based on files in missingTests list
      const missingCount = data.filePaths.filter(p => insights?.missingTests?.includes(p)).length;
      const coverage = data.filePaths.length > 0
        ? Math.round(((data.filePaths.length - missingCount) / data.filePaths.length) * 100)
        : 100;

      return {
        name: name.toUpperCase(),
        count: data.filePaths.length,
        size: data.size,
        coverage,
      };
    }).slice(0, 4);
  }, [files, insights]);

  // Context Menu Actions Handler
  const openContextMenu = (e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuFile(filePath);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // Selected file details
  const fileDetails = useMemo(() => {
    if (!selectedFile) return null;
    const fileItem = files.find(f => f.path === selectedFile);
    const ast = astMetadata && astMetadata[selectedFile];
    const classes = ast?.classes || [];
    const functions = ast?.functions || [];

    const graph = dependencyGraph || { adjacencyList: {}, dependents: {} };
    const dependencies = graph.adjacencyList?.[selectedFile] || [];
    const dependents = graph.dependents?.[selectedFile] || [];

    return {
      path: selectedFile,
      name: selectedFile.split('/').pop() || '',
      size: fileItem?.size || 0,
      lines: fileItem?.lines || 0,
      classes,
      functions,
      dependencies,
      dependents,
    };
  }, [selectedFile, files, astMetadata, dependencyGraph]);

  // Recursive Tree Node Renderer
  const renderNode = (node: TreeNode, depth = 0) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const isExpanded = expandedFolders.has(node.path);

    if (node.path === '') {
      return (
        <div className="flex flex-col gap-0.5">
          {Object.values(node.children).map(child => renderNode(child, depth))}
        </div>
      );
    }

    const allChecked = node.isDirectory ? isFolderSelected(node) : selectedFiles.has(node.path);
    const partialChecked = node.isDirectory ? isFolderPartiallySelected(node) : false;
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.path} className="flex flex-col">
        {/* Row element */}
        <div
          onClick={() => {
            if (node.isDirectory) {
              toggleFolderExpand(node.path);
            } else {
              trackFileView(node.path);
            }
          }}
          onContextMenu={(e) => {
            if (!node.isDirectory) openContextMenu(e, node.path);
          }}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className={`flex items-center gap-2 py-1.5 pr-2 rounded-[4px] cursor-pointer group transition-colors select-none ${
            isSelected
              ? 'bg-[#1f1f22] text-[#fafafa] border-l-2 border-[#3b82f6]'
              : 'hover:bg-[#1f1f22]/50 text-[#c8c5ca] hover:text-[#fafafa]'
          }`}
        >
          {/* Chevron */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (node.isDirectory) toggleFolderExpand(node.path);
            }}
            className="w-4 h-4 flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100"
          >
            {node.isDirectory ? (
              <ChevronIcon expanded={isExpanded} />
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
          </div>

          {/* Toggle Checkbox */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (node.isDirectory) {
                handleFolderCheckboxChange(node);
              } else {
                onToggleFile(node.path);
              }
            }}
            className={`w-3.5 h-3.5 border rounded-[3px] flex items-center justify-center transition-all ${
              allChecked
                ? 'bg-[#3b82f6] border-[#3b82f6]'
                : partialChecked
                ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                : 'border-[#27272a] bg-transparent group-hover:border-[#39393c]'
            }`}
          >
            {allChecked && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {!allChecked && partialChecked && (
              <span className="w-1.5 h-[2px] bg-[#3b82f6] rounded-[1px]" />
            )}
          </div>

          {/* Node Icon */}
          <div className="shrink-0">
            {node.isDirectory ? <FolderIcon /> : <FileIcon name={node.name} />}
          </div>

          {/* Node Name */}
          <span className="font-mono text-[12.5px] truncate flex-1 leading-none pt-0.5">
            {node.name}
          </span>

          {/* Overflow Menu trigger */}
          {!node.isDirectory && (
            <button
              onClick={(e) => openContextMenu(e, node.path)}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#27272a] text-[#919095] hover:text-[#fafafa] cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          )}

          {/* Size Badge */}
          <span className="font-mono text-[10px] text-[#919095] group-hover:text-[#c8c5ca] shrink-0">
            {formatSize(node.size)}
          </span>
        </div>

        {/* Children render */}
        {node.isDirectory && isExpanded && hasChildren && (
          <div className="border-l border-[#27272a]/30 ml-2.5">
            {Object.values(node.children).map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)] lg:h-[calc(100vh-160px)] relative overflow-hidden">
      
      {/* LEFT COLUMN: FILESYSTEM TREE */}
      <div className="w-full lg:w-80 bg-[#0e0e11] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden flex-shrink-0">
        
        {/* Header toolbar */}
        <div className="p-3 border-b border-[#27272a] flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-[#919095] tracking-widest uppercase">Filesystem</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => toast.success('Folders refreshed')}
              className="p-1 text-[#919095] hover:text-[#fafafa] hover:bg-[#1f1f22] rounded-[4px] cursor-pointer"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Input bar */}
        <div className="p-2 border-b border-[#27272a]/70">
          <div className="relative">
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-[4px] pl-8 pr-3 py-1 text-[12px] font-mono text-[#fafafa] placeholder-[#919095] focus:outline-none focus:border-[#3b82f6]"
              placeholder="Search files..."
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#919095] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Tree */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin" data-lenis-prevent>
          {Object.keys(treeRoot.children).length > 0 ? (
            renderNode(treeRoot)
          ) : (
            <div className="p-4 text-center text-[#919095] text-[11px] font-mono">
              No matching files found
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: WORKSPACE DASHBOARD OR DETAILS PANEL */}
      <div className="flex-1 bg-[#131316] border border-[#27272a] rounded-[8px] flex flex-col h-full overflow-hidden">
        
        {/* Dynamic Breadcrumb Bar */}
        <div className="px-4 py-2 bg-[#0e0e11] border-b border-[#27272a] flex items-center justify-between text-[11px] font-mono text-[#919095]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Explorer</span>
            <span>/</span>
            {selectedFile ? (
              selectedFile.split('/').map((part, index, arr) => (
                <React.Fragment key={part}>
                  <span className={index === arr.length - 1 ? 'text-[#fafafa] font-semibold' : ''}>{part}</span>
                  {index < arr.length - 1 && <span>/</span>}
                </React.Fragment>
              ))
            ) : (
              <span className="text-[#fafafa]">Dashboard</span>
            )}
          </div>

          {selectedFile && (
            <button
              onClick={() => setSelectedFile(null)}
              className="text-[#3b82f6] hover:text-[#fafafa] font-semibold cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          )}
        </div>

        {/* Scrollable workspace */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin" data-lenis-prevent>
          
          {fileDetails ? (
            /* ACTIVE SELECTED FILE DETAILS VIEW */
            <div className="space-y-6 animate-[fadeIn_0.15s_ease-out]">
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-[#27272a] pb-4">
                <div>
                  <h3 className="text-[20px] font-heading font-bold text-[#fafafa] flex items-center gap-2">
                    <FileIcon name={fileDetails.name} />
                    {fileDetails.name}
                  </h3>
                  <p className="text-[12px] font-mono text-[#919095] mt-1 break-all">{fileDetails.path}</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePinFile(fileDetails.path)}
                    className={`px-3 py-1.5 rounded-[4px] border text-[12px] font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      pinnedFiles.includes(fileDetails.path)
                        ? 'bg-[#eab308]/10 border-[#eab308] text-[#eab308]'
                        : 'bg-transparent border-[#27272a] text-[#c8c5ca] hover:text-[#fafafa] hover:bg-[#1f1f22]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill={pinnedFiles.includes(fileDetails.path) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                    </svg>
                    {pinnedFiles.includes(fileDetails.path) ? 'Pinned' : 'Pin File'}
                  </button>
                  <button
                    onClick={() => handleCopyPath(fileDetails.path)}
                    className="px-3 py-1.5 rounded-[4px] border border-[#27272a] bg-transparent text-[#c8c5ca] hover:text-[#fafafa] hover:bg-[#1f1f22] text-[12px] font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    Copy Path
                  </button>
                </div>
              </div>

              {/* Scope lock warning */}
              <div className="bg-[#1f1f22]/40 border border-[#27272a] rounded-[6px] p-3 flex justify-between items-center gap-3">
                <div>
                  <h4 className="text-[12px] font-semibold text-[#fafafa]">Assistant Inclusion</h4>
                  <p className="text-[11px] text-[#919095]">Enable this checkbox to feed this file context into the AI Assistant conversation scope.</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedFiles.has(fileDetails.path)}
                  onChange={() => onToggleFile(fileDetails.path)}
                  className="w-4 h-4 rounded-[4px] border-[#27272a] bg-[#09090b] text-[#3b82f6] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#0e0e11] border border-[#27272a] p-3.5 rounded-[6px]">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">File Size</span>
                  <span className="text-[18px] font-bold text-[#fafafa] block mt-1">{formatSize(fileDetails.size)}</span>
                </div>
                <div className="bg-[#0e0e11] border border-[#27272a] p-3.5 rounded-[6px]">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">Line Count</span>
                  <span className="text-[18px] font-bold text-[#fafafa] block mt-1">{fileDetails.lines} lines</span>
                </div>
                <div className="bg-[#0e0e11] border border-[#27272a] p-3.5 rounded-[6px]">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">Inbound Dependents</span>
                  <span className="text-[18px] font-bold text-[#fafafa] block mt-1">{fileDetails.dependents.length}</span>
                </div>
                <div className="bg-[#0e0e11] border border-[#27272a] p-3.5 rounded-[6px]">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">Outbound Dependencies</span>
                  <span className="text-[18px] font-bold text-[#fafafa] block mt-1">{fileDetails.dependencies.length}</span>
                </div>
              </div>

              {/* AST Interface Map */}
              {(fileDetails.classes.length > 0 || fileDetails.functions.length > 0) ? (
                <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] space-y-3">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">Interface Map</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fileDetails.classes.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-mono font-bold text-blue-400 mb-2 uppercase">Classes ({fileDetails.classes.length})</h5>
                        <div className="space-y-1.5">
                          {fileDetails.classes.map((cls: any) => (
                            <div key={cls.name} className="flex items-center gap-2 text-[12px] font-mono text-[#c8c5ca]">
                              <svg className="w-3.5 h-3.5 shrink-0 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                              </svg>
                              {cls.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {fileDetails.functions.length > 0 && (
                      <div>
                        <h5 className="text-[11px] font-mono font-bold text-emerald-400 mb-2 uppercase">Functions ({fileDetails.functions.length})</h5>
                        <div className="space-y-1.5">
                          {fileDetails.functions.map((fn: any) => (
                            <div key={fn.name} className="flex items-center gap-2 text-[12px] font-mono text-[#c8c5ca]">
                              <svg className="w-3.5 h-3.5 shrink-0 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                              </svg>
                              {fn.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Dependents list */}
              {fileDetails.dependents.length > 0 && (
                <div className="bg-[#0e0e11] border border-[#27272a] p-4 rounded-[6px] space-y-2">
                  <span className="text-[10px] font-mono font-bold text-[#919095] uppercase block">Inbound Dependents ({fileDetails.dependents.length})</span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-[12px] text-[#c8c5ca]">
                    {fileDetails.dependents.map((dep: string) => (
                      <div
                        key={dep}
                        onClick={() => trackFileView(dep)}
                        className="p-1 px-2 rounded hover:bg-[#1f1f22] hover:text-[#3b82f6] cursor-pointer transition-colors"
                      >
                        {dep}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions row */}
              <div className="flex gap-3 pt-4 border-t border-[#27272a]">
                <button
                  onClick={() => toast.success(`Staged optimization plan for ${fileDetails.name}`)}
                  className="bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-semibold text-body-base py-2 px-5 rounded-[4px] cursor-pointer flex items-center gap-2 transition-colors"
                >
                  Optimize Module
                </button>
                <button
                  onClick={() => toast.success(`Opened ${fileDetails.name} in local editor.`)}
                  className="bg-transparent border border-[#27272a] text-[#c8c5ca] hover:text-[#fafafa] hover:bg-[#1f1f22] font-semibold text-body-base py-2 px-5 rounded-[4px] cursor-pointer flex items-center gap-2 transition-all"
                >
                  Open in Editor
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT DASHBOARD STATE (BENTO BOX LAYOUT) */
            <div className="space-y-8 animate-[fadeIn_0.15s_ease-out]">
              
              {/* Recently Viewed & Pinned Modules Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Recently Viewed */}
                <div className="bg-[#0e0e11] border border-[#27272a] p-5 rounded-[6px] flex flex-col h-[280px]">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-body-base font-bold text-[#fafafa] flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recently Viewed
                    </h3>
                    <span className="text-[9px] font-mono font-bold text-[#919095] bg-[#1f1f22] border border-[#27272a] px-2 py-0.5 rounded-[4px] uppercase tracking-wider">
                      Current Session
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin" data-lenis-prevent>
                    {recentlyViewed.length > 0 ? (
                      recentlyViewed.map(item => (
                        <div
                          key={item.path}
                          onClick={() => setSelectedFile(item.path)}
                          className="flex items-center justify-between p-2 rounded-[4px] bg-[#131316] hover:bg-[#1f1f22] border border-transparent hover:border-[#27272a] transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileIcon name={item.path.split('/').pop() || ''} />
                            <div className="flex flex-col truncate">
                              <span className="text-[12.5px] font-semibold text-[#fafafa] leading-tight truncate">
                                {item.path.split('/').pop()}
                              </span>
                              <span className="text-[10px] text-[#919095] truncate font-mono mt-0.5">
                                {item.path}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#919095] group-hover:text-[#3b82f6] shrink-0 font-mono">
                            {getRelativeTime(item.timestamp)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#919095] text-[12px] font-mono">
                        No files viewed yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Pinned Modules */}
                <div className="bg-[#0e0e11] border border-[#27272a] p-5 rounded-[6px] flex flex-col h-[280px]">
                  <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-body-base font-bold text-[#fafafa] flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#eab308]" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z" clipRule="evenodd" />
                      </svg>
                      Pinned Modules
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin" data-lenis-prevent>
                    {pinnedFiles.length > 0 ? (
                      pinnedFiles.map(filePath => (
                        <div
                          key={filePath}
                          onClick={() => setSelectedFile(filePath)}
                          className="flex items-center justify-between p-2 rounded-[4px] bg-[#131316] hover:bg-[#1f1f22] border border-transparent hover:border-[#27272a] transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileIcon name={filePath.split('/').pop() || ''} />
                            <div className="flex flex-col truncate">
                              <span className="text-[12.5px] font-semibold text-[#fafafa] leading-tight truncate">
                                {filePath.split('/').pop()}
                              </span>
                              <span className="text-[10px] text-[#919095] truncate font-mono mt-0.5">
                                {filePath}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinFile(filePath);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#919095] hover:text-[#eab308] cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-[#919095] text-[12px] font-mono">
                        Right-click a file in filesystem tree to pin
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* AI Recommendations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#3b82f6] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-8.904m-8.904 0L4 12l8.904-8.904m0 0L13.5 3l-8.904 8.904m8.904 0l8.904 8.904m-8.904 0L20 12l-8.904-8.904" />
                  </svg>
                  <h3 className="text-[18px] font-heading font-bold text-[#fafafa]">AI Analysis &amp; Recommendations</h3>
                </div>

                {loadingInsights ? (
                  <div className="p-8 text-center bg-[#0e0e11] border border-[#27272a] rounded-[6px]">
                    <div className="w-6 h-6 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto" />
                    <span className="text-[12px] text-[#919095] mt-2 block">Analyzing repository telemetry...</span>
                  </div>
                ) : recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className={`p-5 rounded-[6px] border flex flex-col justify-between hover:scale-[1.01] transition-transform ${
                          rec.type === 'critical'
                            ? 'bg-[#93000a]/5 border-[#93000a]/20 hover:border-[#93000a]/40'
                            : rec.type === 'refactor'
                            ? 'bg-[#eab308]/5 border-[#eab308]/20 hover:border-[#eab308]/40'
                            : 'bg-[#3b82f6]/5 border-[#3b82f6]/20 hover:border-[#3b82f6]/40'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-[4px] border uppercase ${
                              rec.type === 'critical'
                                ? 'bg-[#93000a]/20 border-[#93000a]/40 text-[#ffb4ab]'
                                : rec.type === 'refactor'
                                ? 'bg-[#eab308]/20 border-[#eab308]/40 text-[#fcd34d]'
                                : 'bg-[#3b82f6]/20 border-[#3b82f6]/40 text-[#60a5fa]'
                            }`}>
                              {rec.type}
                            </span>
                          </div>
                          <h4 className="text-[13.5px] font-bold text-[#fafafa] mb-1.5">{rec.title}</h4>
                          <p className="text-[12px] text-[#919095] leading-relaxed">{rec.desc}</p>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-[#27272a]/50">
                          <button
                            onClick={rec.action}
                            className="text-[#3b82f6] hover:text-[#60a5fa] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {rec.linkText} →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-[#0e0e11] border border-[#27272a] rounded-[6px] text-[#919095] text-[12.5px] font-mono">
                    No active issues detected. Repository structure is clean.
                  </div>
                )}
              </div>

              {/* Module Groups (Dynamically Grouped Folders) */}
              <div className="space-y-3">
                <h3 className="text-body-base font-bold text-[#fafafa] flex items-center gap-2">
                  <svg className="w-4.5 h-4.5 text-[#919095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Module Groups
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {moduleGroups.map(group => (
                    <div
                      key={group.name}
                      className="border border-[#27272a] rounded-[6px] bg-[#0e0e11] overflow-hidden flex flex-col justify-between"
                    >
                      <div className="bg-[#1f1f22]/50 p-3 border-b border-[#27272a]/70">
                        <span className="text-[10px] font-mono font-bold text-[#fafafa] tracking-wide block truncate">
                          {group.name}
                        </span>
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div className="flex justify-between text-[11px] text-[#919095] mb-2 font-mono">
                          <span>{group.count} Files</span>
                          <span>{formatSize(group.size)}</span>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-[#919095] mb-1 font-mono">
                            <span>Test Coverage</span>
                            <span className={group.coverage >= 80 ? 'text-emerald-400' : 'text-amber-400'}>{group.coverage}%</span>
                          </div>
                          <div className="w-full bg-[#1f1f22] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                group.coverage >= 80 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${group.coverage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* FLOAT CONTEXT MENU */}
      {activeMenuFile && menuPosition && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setActiveMenuFile(null); setMenuPosition(null); }} />
          <div
            ref={menuRef}
            style={{ top: `${menuPosition.y}px`, left: `${menuPosition.x}px` }}
            className="fixed z-50 w-44 bg-[#131316] border border-[#27272a] rounded-[6px] shadow-2xl p-1 animate-[fadeIn_0.1s_ease-out]"
          >
            <button
              onClick={() => {
                handleCopyPath(activeMenuFile);
                setActiveMenuFile(null);
                setMenuPosition(null);
              }}
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] flex items-center gap-2 cursor-pointer font-mono"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Path
            </button>
            <button
              onClick={() => {
                togglePinFile(activeMenuFile);
                setActiveMenuFile(null);
                setMenuPosition(null);
              }}
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] flex items-center gap-2 cursor-pointer font-mono"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              {pinnedFiles.includes(activeMenuFile) ? 'Unpin File' : 'Pin File'}
            </button>
            <button
              onClick={() => {
                trackFileView(activeMenuFile);
                setActiveMenuFile(null);
                setMenuPosition(null);
              }}
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-[#1f1f22] rounded-[4px] text-[#c8c5ca] hover:text-[#fafafa] border-t border-[#27272a]/50 mt-1 flex items-center gap-2 cursor-pointer font-mono"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open Details
            </button>
          </div>
        </>
      )}
    </div>
  );
}
