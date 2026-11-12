import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { FileItem, ArchitecturalRole, DriftViolation } from './explorerTypes';
import { getRoleLabel, formatBytes } from './explorerUtils';
import { toast } from 'sonner';

/**
 * ExplorerCodeViewer — the centre plate of the Explorer.
 *
 * Three parts, in the order the reader needs them:
 *   1. a tab strip carrying the file's real structural counts
 *      (`importers · 218`, `imports · 11`, `symbols · 6`)
 *   2. the source itself on the dark plate, with line numbers and the import
 *      block highlighted
 *   3. (the intel panel lives beside it, rendered by ExplorerTab)
 *
 * The source is fetched from `GET /repos/:id/file?path=…`, which reassembles it
 * from the `CodeChunk` rows the indexer stored. It is the real file, not a
 * summary. When a file was never chunked the viewer says so plainly instead of
 * showing an empty editor.
 */

interface FileResponse {
  path: string;
  indexed: boolean;
  language?: string;
  lines?: string[];
  startLine?: number;
  endLine?: number;
  symbols?: Array<{ name: string; startLine: number; endLine: number }>;
}

interface ExplorerCodeViewerProps {
  file: FileItem;
  repositoryId: string;
  astMetadata?: Record<string, { imports?: string[]; exports?: string[]; functions?: string[]; classes?: string[] }>;
  dependencyGraph?: Record<string, string[]>;
  role: ArchitecturalRole;
  driftViolations?: DriftViolation[];
  cycleInvolvement?: string[][];
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

/**
 * Tokeniser for the dark plate.
 *
 * Deliberately shallow: it colours comments, strings, numbers, keywords and
 * capitalised identifiers, which is enough to read a file by. A full parser in
 * the browser would cost more than it shows.
 */
const KEYWORDS =
  /^(import|export|from|default|const|let|var|function|return|if|else|switch|case|break|continue|for|while|do|try|catch|finally|throw|class|extends|implements|interface|type|enum|public|private|protected|readonly|static|async|await|new|this|typeof|instanceof|void|as|in|of|yield|delete)$/;

function renderCodeLine(lineText: string) {
  if (!lineText) return <span>&#8203;</span>;

  const trimmed = lineText.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
    return <span className="italic text-[#5f6672]">{lineText}</span>;
  }

  const tokens = lineText.split(/(\s+|[{}()[\];,.<>=:!+*&|?~^-])/);
  return (
    <>
      {tokens.map((token, i) => {
        if (!token) return null;
        if (KEYWORDS.test(token)) return <span key={i} className="text-[#c792ea]">{token}</span>;
        if (/^(['"`]).*\1$/.test(token)) return <span key={i} className="text-[#c3e88d]">{token}</span>;
        if (/^\d+(\.\d+)?$/.test(token)) return <span key={i} className="text-[#ffcb6b]">{token}</span>;
        if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) return <span key={i} className="text-[#82aaff]">{token}</span>;
        return <span key={i} className="text-[#c8cdd6]">{token}</span>;
      })}
    </>
  );
}

export default function ExplorerCodeViewer({
  file,
  repositoryId,
  astMetadata,
  dependencyGraph,
  role,
  inDegree,
  onNavigateToGraph,
  onNavigateToImpact,
  onTriggerChat,
  onToggleScope,
  isScopeSelected,
}: ExplorerCodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyStructure, setOnlyStructure] = useState(false);

  const path = file?.path ?? '';

  /* ── fetch the real source for the selected file ───────────────────── */
  useEffect(() => {
    if (!repositoryId || !path) return;
    let cancelled = false;
    setLoading(true);
    setData(null);

    api
      .get(`/repos/${repositoryId}/file`, { params: { path } })
      .then((res) => {
        if (!cancelled) setData(res.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setData({ path, indexed: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repositoryId, path]);

  /* ── real structural counts, all derived from backend data ─────────── */
  const counts = useMemo(() => {
    const ast = astMetadata?.[path];
    const outbound = dependencyGraph?.[path]?.length ?? 0;
    const symbols =
      (ast?.functions?.length ?? 0) +
      (ast?.classes?.length ?? 0) +
      (ast?.exports?.length ?? 0);
    return {
      importers: inDegree ?? 0,
      imports: outbound,
      symbols,
      lines: data?.lines?.length ?? file?.lines ?? null,
    };
  }, [astMetadata, dependencyGraph, path, inDegree, data, file]);

  const lines = data?.lines ?? [];
  const symbolRanges = data?.symbols ?? [];

  /* the leading import block is highlighted: it is what the graph is built from */
  const importEnd = useMemo(() => {
    let last = -1;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('import ') || t.startsWith('const ') && t.includes('require(') || /require\(/.test(t)) {
        last = i;
      }
      // stop scanning once real code starts, so we do not highlight the whole file
      if (i > 60 && last >= 0) break;
    }
    return last;
  }, [lines]);

  const copyPath = () => {
    navigator.clipboard?.writeText(path);
    setCopied(true);
    toast.success('Path copied');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── tab strip: file, then its measured structure ──────────────── */}
      <div className="viewer__tabs">
        <span className="vtab is-on !min-w-[110px] text-center">{path.split('/').pop()}</span>
        <button
          type="button"
          onClick={() => setOnlyStructure((v) => !v)}
          className="vtab hover:text-[#e6e9ee]"
          title="Toggle structure-only view"
        >
          structure
        </button>
        <span className="vtab">importers · {counts.importers}</span>
        <span className="vtab">imports · {counts.imports}</span>
        <span className="vtab">symbols · {counts.symbols}</span>
        {counts.lines != null && <span className="vtab">{counts.lines} lines</span>}

        <div className="ml-auto flex items-center gap-2 px-3">
          {onToggleScope && (
            <button
              type="button"
              onClick={onToggleScope}
              className={`font-mono text-[9px] uppercase tracking-[0.13em] transition-colors ${
                isScopeSelected ? 'text-[#25d0a0]' : 'text-[#5f646f] hover:text-[#9aa0ab]'
              }`}
            >
              {isScopeSelected ? '✓ in scope' : 'add to scope'}
            </button>
          )}
          <button
            type="button"
            onClick={copyPath}
            className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#5f646f] transition-colors hover:text-[#9aa0ab]"
          >
            {copied ? 'copied' : 'copy path'}
          </button>
        </div>
      </div>

      {/* ── the source ─────────────────────────────────────────────────── */}
      <div className="viewer flex min-h-0 flex-1 flex-col">
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f646f]">
              Reading {path.split('/').pop()}…
            </span>
          </div>
        )}

        {!loading && data?.indexed === false && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="font-mono text-[11px] text-[#9aa0ab]">
              Source not indexed for this file
            </p>
            <p className="max-w-[46ch] font-mono text-[9.5px] leading-[1.7] text-[#5f646f]">
              The parser read its structure and its place in the import graph, but the file
              was not selected for chunking, so no source text was kept.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              {onNavigateToGraph && (
                <button
                  type="button"
                  onClick={() => onNavigateToGraph(path)}
                  className="rounded-[3px] border border-[#31353e] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9aa0ab] transition-colors hover:border-[#4a4f59] hover:text-[#e6e9ee]"
                >
                  view in architecture
                </button>
              )}
              {onNavigateToImpact && (
                <button
                  type="button"
                  onClick={() => onNavigateToImpact(path)}
                  className="rounded-[3px] border border-[#31353e] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9aa0ab] transition-colors hover:border-[#4a4f59] hover:text-[#e6e9ee]"
                >
                  analyze blast radius
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && data?.indexed && !onlyStructure && (
          <div className="vcode min-h-0 flex-1">
            {lines.map((line, i) => {
              const n = i + 1;
              const inImportBlock = i <= importEnd && importEnd >= 0;
              const symbolHere = symbolRanges.find((s) => s.startLine === n);
              return (
                <div key={i}>
                  {symbolHere && (
                    <div className="flex items-center gap-3 px-4 py-1.5">
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-[#25d0a0]">
                        {symbolHere.name}
                      </span>
                      <span className="h-px flex-1 bg-[#25282f]" />
                      <span className="font-mono text-[8.5px] text-[#4f545e]">
                        L{symbolHere.startLine}–{symbolHere.endLine}
                      </span>
                    </div>
                  )}
                  <div className={`vline ${inImportBlock ? 'hl' : ''}`}>
                    <span className="ln">{n}</span>
                    <span>{renderCodeLine(line)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && data?.indexed && onlyStructure && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="mb-4 font-mono text-[9px] uppercase tracking-[0.16em] text-[#686d78]">
              Structure only · {symbolRanges.length} symbol{symbolRanges.length === 1 ? '' : 's'}
            </div>
            {symbolRanges.length === 0 ? (
              <p className="font-mono text-[10px] text-[#5f646f]">
                The parser found no named symbols in this file.
              </p>
            ) : (
              symbolRanges.map((s) => (
                <div key={`${s.name}-${s.startLine}`} className="flex items-baseline justify-between border-b border-[#23262d] py-2">
                  <span className="font-mono text-[11px] text-[#c8cdd6]">{s.name}</span>
                  <span className="font-mono text-[9.5px] text-[#4f545e]">
                    L{s.startLine}–{s.endLine}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── what this file is, in one line ─────────────────────────────── */}
      <div className="flex flex-none items-center gap-4 border-t border-[#23262d] px-4 py-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#686d78]">
          {getRoleLabel(role)}
        </span>
        <span className="font-mono text-[9.5px] text-[#4f545e]">{formatBytes(file.size)}</span>
        <span className="font-mono text-[9.5px] text-[#4f545e]">{data?.language ?? '—'}</span>
        {onTriggerChat && (
          <button
            type="button"
            onClick={() => onTriggerChat(`Explain what ${path} does and what depends on it.`)}
            className="ml-auto font-mono text-[9px] uppercase tracking-[0.13em] text-[#25d0a0] transition-opacity hover:opacity-70"
          >
            ask about this file →
          </button>
        )}
      </div>
    </div>
  );
}
