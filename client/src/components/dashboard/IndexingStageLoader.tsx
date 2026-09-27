import React from 'react';
import { Button } from '../ui/DesignSystem';

/**
 * Full-screen stage loader shown while a repository index is in progress.
 *
 * It is driven entirely by backend state (`indexingStatus` / `indexingProgress`
 * / `indexingStats`), never a client-side timer, so the percentage and stage are
 * honest. Repository data is only rendered once the run is `completed`.
 */
export interface IndexingStageLoaderProps {
  name: string;
  status: string;
  progress: string;
  stats?: any;
  onRetry: () => void;
  retrying?: boolean;
}

const STAGE_ORDER = ['download', 'extract', 'parse', 'embed', 'summary', 'done'] as const;
type StageKey = typeof STAGE_ORDER[number];

const STAGE_META: Record<StageKey, { label: string; desc: string }> = {
  download: { label: 'Download', desc: 'Fetching ZIP archive from GitHub' },
  extract: { label: 'Extract', desc: 'Unpacking repository archive' },
  parse: { label: 'Parse', desc: 'AST, dependency graph, identity' },
  embed: { label: 'Embed', desc: 'Embedding code chunks' },
  summary: { label: 'Summary', desc: 'Generating AI repository summary' },
  done: { label: 'Done', desc: 'Finalizing index' },
};

function resolveStage(stats: any, progress: string): StageKey {
  const s = stats?.stage;
  if (typeof s === 'string' && (STAGE_ORDER as readonly string[]).includes(s)) {
    return s as StageKey;
  }
  const p = (progress || '').toLowerCase();
  if (p.includes('completed')) return 'done';
  if (p.includes('summary')) return 'summary';
  if (p.includes('embedding')) return 'embed';
  if (p.includes('pars')) return 'parse';
  return 'download';
}

function resolvePercent(stats: any, progress: string): number {
  const m = /(\d+)%/.exec(progress || '');
  if (m) {
    const raw = parseInt(m[1], 10);
    if (/embedding/i.test(progress)) return Math.min(95, 30 + Math.round(raw * 0.65));
    return Math.min(99, Math.max(0, raw));
  }
  const idx = STAGE_ORDER.indexOf(resolveStage(stats, progress));
  return idx <= 0 ? 5 : Math.min(95, Math.round((idx / (STAGE_ORDER.length - 1)) * 95));
}

export const IndexingStageLoader: React.FC<IndexingStageLoaderProps> = ({
  name,
  status,
  progress,
  stats,
  onRetry,
  retrying = false,
}) => {
  const failed = status === 'failed';
  const stage = resolveStage(stats, progress);
  const percent = failed ? resolvePercent(stats, progress) : resolvePercent(stats, progress);
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const chunks = stats?.chunksTotal ?? stats?.chunks ?? null;

  return (
    <div className="stitch-theme fixed inset-0 flex items-center justify-center bg-[#09090b] p-6 overflow-y-auto">
      <div className="w-full max-w-[560px]">
        <div className="mb-5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717a] mb-1">
            {failed ? 'Index failed' : 'System analysis'}
          </div>
          <h1 className="text-[22px] font-semibold text-[#fafafa] leading-tight">
            {failed ? 'Indexing could not complete' : 'Compiling Codebase Intelligence…'}
          </h1>
          <p className="text-[13px] text-[#a1a1aa] mt-1 font-mono">{name}</p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[#18181b] overflow-hidden mb-1.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${failed ? 'bg-red-500/70' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
            style={{ width: `${Math.max(4, percent)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-[#71717a] mb-5">
          <span>{failed ? 'Halted' : 'In progress'}</span>
          <span className="tabular-nums text-[#e4e4e7]">{percent}%</span>
        </div>

        {/* Stage checklist */}
        <div className="rounded-lg border border-[#27272a] bg-[#0e0e11] divide-y divide-[#27272a]/60 mb-5">
          {STAGE_ORDER.map((key, idx) => {
            const done = !failed && idx < currentIdx;
            const active = !failed && idx === currentIdx;
            const errored = failed && idx === currentIdx;
            return (
              <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-mono border ${
                    done
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : active
                      ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                      : errored
                      ? 'bg-red-500/15 border-red-500/50 text-red-300'
                      : 'bg-[#18181b] border-[#27272a] text-[#52525b]'
                  }`}
                >
                  {done ? '✓' : errored ? '!' : idx + 1}
                </span>
                <div className="min-w-0">
                  <div className={`text-[12.5px] ${active || done ? 'text-[#fafafa]' : 'text-[#a1a1aa]'}`}>
                    {STAGE_META[key].label}
                  </div>
                  <div className="text-[11px] text-[#71717a] truncate">{STAGE_META[key].desc}</div>
                </div>
                {active && !failed && (
                  <span className="ml-auto h-3 w-3 shrink-0 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin" />
                )}
              </div>
            );
          })}
        </div>

        {/* Honest chunk/file counts */}
        {!failed && (chunks != null || stats?.filesProcessed != null) && (
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-[#a1a1aa]">
            {stats?.filesProcessed != null && (
              <span>
                Files: <span className="text-[#e4e4e7]">{stats.filesProcessed}{stats?.filesEmbedded ? `/${stats.filesEmbedded}` : ''}</span>
              </span>
            )}
            {chunks != null && (
              <span>
                Chunks: <span className="text-[#e4e4e7]">{chunks}</span>
              </span>
            )}
          </div>
        )}

        {failed && (
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-4 mb-5">
            <p className="text-[12.5px] text-red-200 m-0 break-words">
              {progress?.replace(/^Error:\s*/i, '') || 'The index could not be completed.'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#71717a] font-mono">
            {failed ? 'Repository data is hidden until indexing completes.' : 'Dashboard unlocks automatically when indexing completes.'}
          </span>
          {failed && (
            <Button variant="secondary" size="sm" onClick={onRetry} isLoading={retrying} className="font-mono text-[11px]">
              {retrying ? 'Retrying…' : 'Retry indexing'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndexingStageLoader;
