import React, { useState, useMemo } from 'react';

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
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children: Record<string, TreeNode>;
}

export default function ScopeSelector({
  files,
  selectedFiles,
  onToggleFile,
  onToggleFolder,
}: ScopeSelectorProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));

  // Construct a directory tree from the flat list of files
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      path: '',
      isDirectory: true,
      size: 0,
      children: {},
    };

    for (const file of files) {
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
  }, [files]);

  // Recursively gathers all files under a folder path
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

  // Checks if all files inside a folder are currently selected
  const isFolderSelected = (node: TreeNode): boolean => {
    const folderFiles = getFilesInFolder(node);
    if (folderFiles.length === 0) return false;
    return folderFiles.every(f => selectedFiles.has(f));
  };

  // Checks if some (but not all) files inside a folder are currently selected
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

  // Helper function to recursively render nodes
  const renderNode = (node: TreeNode, depth = 0) => {
    const hasChildren = Object.keys(node.children).length > 0;
    const isExpanded = expandedFolders.has(node.path);
    
    // Skip rendering the root element itself
    if (node.path === '') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {Object.values(node.children).map(child => renderNode(child, depth))}
        </div>
      );
    }

    const allChecked = node.isDirectory ? isFolderSelected(node) : selectedFiles.has(node.path);
    const partialChecked = node.isDirectory ? isFolderPartiallySelected(node) : false;

    return (
      <div key={node.path} style={{ marginLeft: `${depth * 16}px` }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '13px',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
        className="tree-node-row"
        >
          {/* Collapse/Expand Arrow */}
          {node.isDirectory ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpand(node.path);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                color: 'rgba(255, 255, 255, 0.4)',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              ▶
            </span>
          ) : (
            <span style={{ width: '18px' }} />
          )}

          {/* Checkbox */}
          <div
            onClick={() => {
              if (node.isDirectory) {
                handleFolderCheckboxChange(node);
              } else {
                onToggleFile(node.path);
              }
            }}
            style={{
              width: '16px',
              height: '16px',
              border: `1.5px solid ${allChecked || partialChecked ? '#3b82f6' : 'rgba(255, 255, 255, 0.3)'}`,
              borderRadius: '4px',
              background: allChecked ? '#3b82f6' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {allChecked && <span style={{ color: '#fff', fontSize: '9px', fontWeight: 'bold' }}>✓</span>}
            {!allChecked && partialChecked && <span style={{ width: '8px', height: '2px', background: '#3b82f6', borderRadius: '1px' }} />}
          </div>

          {/* Icon + Label */}
          <span
            onClick={() => {
              if (node.isDirectory) {
                toggleFolderExpand(node.path);
              } else {
                onToggleFile(node.path);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: node.isDirectory ? '#93c5fd' : 'rgba(255, 255, 255, 0.9)',
              fontFamily: 'var(--font-mono)',
              flexGrow: 1,
            }}
          >
            {node.isDirectory ? '📁' : '📄'}
            {node.name}
          </span>

          {/* Size */}
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-mono)', paddingRight: '8px' }}>
            {formatSize(node.size)}
          </span>
        </div>

        {/* Children Render */}
        {node.isDirectory && isExpanded && hasChildren && (
          <div style={{ marginTop: '2px' }}>
            {Object.values(node.children).map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
          Codebase File Selector
        </h3>
        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '4px', lineHeight: '1.4' }}>
          Select the folders and files you want the AI to analyze. Unchecking large folders (like docs or tests) keeps context analysis precise.
        </p>
      </div>

      <div style={{
        flexGrow: 1,
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.01)',
      }}>
        {renderNode(treeRoot)}
      </div>
    </div>
  );
}
