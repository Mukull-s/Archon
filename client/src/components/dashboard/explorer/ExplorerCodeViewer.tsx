import React, { useState } from 'react';
import { FileItem, ArchitecturalRole, DriftViolation } from './explorerTypes';
import { getRoleBadgeStyle, detectLanguage, formatBytes } from './explorerUtils';
import { toast } from 'sonner';

interface ExplorerCodeViewerProps {
  file: FileItem;
  role: ArchitecturalRole;
  driftViolations: DriftViolation[];
  cycleInvolvement: string[][];
  inDegree: number;
  isMissingTest: boolean;
  isDeadCode: boolean;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onNavigateToTrace?: (filePath?: string) => void;
  onTriggerChat?: (prompt: string) => void;
  onSelectFile?: (filePath: string) => void;
  onToggleScope?: () => void;
  isScopeSelected?: boolean;
}

// Tokenizer for light syntax coloring
function renderCodeLine(lineText: string, index: number) {
  // Truncate or empty line
  if (!lineText) {
    return <span className="text-zinc-600">&#8203;</span>;
  }

  // Comments
  if (lineText.trim().startsWith('//') || lineText.trim().startsWith('/*') || lineText.trim().startsWith('*')) {
    return <span className="text-zinc-500 italic">{lineText}</span>;
  }

  // Basic regex tokenizer
  const tokens = lineText.split(/(\s+|[{}()[\];,.<>=:!+*&|?~^-])/);

  return (
    <span>
      {tokens.map((token, i) => {
        if (!token) return null;

        // Keywords
        if (/^(import|export|from|const|let|var|function|return|if|else|switch|case|default|for|while|do|try|catch|finally|throw|class|extends|implements|interface|type|enum|public|private|protected|readonly|static|async|await|new|this|typeof|instanceof|void|as|in|of)$/.test(token)) {
          return <span key={i} className="text-purple-400 font-semibold">{token}</span>;
        }

        // Strings
        if (/^(['"`]).*\1$/.test(token) || token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
          return <span key={i} className="text-emerald-400">{token}</span>;
        }

        // Numbers & Booleans
        if (/^\d+(\.\d+)?$/.test(token) || token === 'true' || token === 'false' || token === 'null' || token === 'undefined') {
          return <span key={i} className="text-amber-400">{token}</span>;
        }

        // Types / Capitalized identifiers
        if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
          return <span key={i} className="text-sky-300">{token}</span>;
        }

        return <span key={i} className="text-zinc-300">{token}</span>;
      })}
    </span>
  );
}

export default function ExplorerCodeViewer({
  file,
  role,
  driftViolations,
  cycleInvolvement,
  inDegree,
  isMissingTest,
  isDeadCode,
  onNavigateToGraph,
  onNavigateToImpact,
  onNavigateToTrace,
  onTriggerChat,
  onSelectFile,
  onToggleScope,
  isScopeSelected
}: ExplorerCodeViewerProps) {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const roleStyle = getRoleBadgeStyle(role);
  const language = detectLanguage(file.path);
  const pathParts = file.path.replace(/\\/g, '/').split('/');
  const fileName = pathParts[pathParts.length - 1];

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
    setCopiedPath(true);
    toast.success('File path copied to clipboard');
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCode = () => {
    if (file.content) {
      navigator.clipboard.writeText(file.content);
      setCopiedCode(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const lines = file.content ? file.content.split('\n') : [];

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden">
      {/* 1. TOP HEADER / BREADCRUMBS BAR */}
      <div className="p-3 border-b border-zinc-800/80 bg-[#0e0e11] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 font-mono text-[12px] text-zinc-400 truncate">
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-zinc-600">/</span>}
                <span className={idx === pathParts.length - 1 ? 'text-white font-semibold' : 'hover:text-zinc-300'}>
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Architectural Role Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${roleStyle.bg} ${roleStyle.text} border ${roleStyle.border}`}
          >
            {roleStyle.label}
          </span>

          {/* Hotspot Centrality Badge */}
          {inDegree > 0 && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1"
              title={`${inDegree} incoming imports`}
            >
              ★ {inDegree} Callers
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleScope && (
            <button
              onClick={onToggleScope}
              className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1.5 border transition-colors cursor-pointer ${
                isScopeSelected
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Include in AI Context scope"
            >
              <span>{isScopeSelected ? '✓ In AI Scope' : '+ AI Scope'}</span>
            </button>
          )}

          <button
            onClick={handleCopyPath}
            className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer"
            title="Copy file path"
          >
            {copiedPath ? 'Copied!' : 'Copy Path'}
          </button>

          {file.content && (
            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1 rounded text-[11px] font-mono bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer"
              title="Copy entire code"
            >
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>
          )}
        </div>
      </div>

      {/* 2. CONTEXTUAL ARCHITECTURAL WARNING STRIP */}
      {(driftViolations.length > 0 || cycleInvolvement.length > 0 || isMissingTest) && (
        <div className="bg-[#141014] border-b border-rose-900/40 p-3 space-y-2 flex-shrink-0">
          {/* Architectural Drift Warning */}
          {driftViolations.map((violation, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 text-[12px] font-mono">
              <div className="flex items-center gap-2 text-rose-300 min-w-0">
                <span className="text-rose-400 font-bold shrink-0">⚠ LAYER DRIFT:</span>
                <span className="truncate">{violation.violation}</span>
                <span className="text-zinc-500 shrink-0">
                  ({violation.filePath === file.path ? `imports ${violation.targetPath}` : `imported by ${violation.filePath}`})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onNavigateToGraph && (
                  <button
                    onClick={() => onNavigateToGraph(file.path)}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    View in Graph
                  </button>
                )}
                {onTriggerChat && (
                  <button
                    onClick={() => onTriggerChat(`Explain and propose a fix for this layer drift violation involving ${file.path}: ${violation.violation}`)}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Explain Fix
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Circular Dependency Warning */}
          {cycleInvolvement.map((cycle, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 text-[12px] font-mono">
              <div className="flex items-center gap-2 text-amber-300 min-w-0">
                <span className="text-amber-400 font-bold shrink-0">⚠ IMPORT CYCLE:</span>
                <span className="truncate">{cycle.join(' ➔ ')}</span>
              </div>
              {onNavigateToGraph && (
                <button
                  onClick={() => onNavigateToGraph(file.path)}
                  className="text-[11px] text-amber-400 hover:underline cursor-pointer shrink-0"
                >
                  View Cycle
                </button>
              )}
            </div>
          ))}

          {/* Missing Test Warning */}
          {isMissingTest && (
            <div className="flex items-center justify-between gap-3 text-[12px] font-mono text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 font-bold">ℹ COVERAGE GAP:</span>
                <span>Active {role.toLowerCase()} has no corresponding test or spec file.</span>
              </div>
              {onTriggerChat && (
                <button
                  onClick={() => onTriggerChat(`Generate comprehensive unit tests with edge cases for ${file.path}`)}
                  className="text-[11px] text-primary hover:underline cursor-pointer shrink-0"
                >
                  Generate Tests
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. CODE VIEWER AREA */}
      <div className="flex-1 overflow-auto font-mono text-[12px] leading-[1.6] bg-[#09090b] relative">
        {lines.length > 0 ? (
          <div className="flex min-w-full py-2">
            {/* Gutter (Line Numbers) */}
            <div className="select-none text-right pr-4 pl-3 text-zinc-600 bg-[#09090b] border-r border-zinc-800/40 shrink-0 sticky left-0 z-10">
              {lines.map((_, i) => (
                <div key={i} className="h-5 flex items-center justify-end text-[11px]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Content */}
            <div className="pl-4 pr-6 flex-1 whitespace-pre overflow-x-visible">
              {lines.map((line, i) => (
                <div key={i} className="h-5 flex items-center hover:bg-zinc-800/30">
                  {renderCodeLine(line, i)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-500 space-y-3">
            <svg className="w-10 h-10 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div>
              <p className="text-zinc-300 font-medium">Source code indexed in metadata cache</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm">
                File structural AST and relationships are mapped. Use the Intelligence Inspector on the right to review architectural role, dependencies, and blast radius.
              </p>
            </div>
            {onNavigateToGraph && (
              <button
                onClick={() => onNavigateToGraph(file.path)}
                className="px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[12px] font-mono"
              >
                View File in Architecture Graph ➔
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div className="px-3 py-1.5 border-t border-zinc-800/80 bg-[#0c0c0f] flex items-center justify-between text-[11px] font-mono text-zinc-500 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>{language}</span>
          <span>{lines.length || file.lines} lines</span>
          <span>{formatBytes(file.size)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>UTF-8</span>
          <span className="text-zinc-400">Archon AST Analyzer</span>
        </div>
      </div>
    </div>
  );
}
