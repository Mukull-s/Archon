import React from 'react';
import { Substrate } from '../site/Substrate';
import { STAGE_ORDER, STAGE_META, resolveStage, resolvePercent, type IndexingStats } from './indexingStages';

/**
 * Full-screen stage plate shown while a repository index is in progress.
 *
 * Plate & Paper, matching the analyse page so a run looks the same wherever the
 * user happens to be when it happens.
 *
 * It is driven entirely by backend state (`indexingStatus` / `indexingProgress`
 * / `indexingStats`), never a client-side timer, so the percentage and stage are
 * honest. Repository data is only rendered once the run is `completed`.
 *
 * The stage mapping lives in `./indexingStages` so this plate and the analyse
 * page cannot drift apart — one definition of "where is the index right now".
 */
export interface IndexingStageLoaderProps {
  name: string;
  status: string;
  progress: string;
  stats?: IndexingStats;
  onRetry: () => void;
  retrying?: boolean;
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
  const percent = resolvePercent(stats, progress);
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const chunks = stats?.chunksTotal ?? stats?.chunks ?? null;

  return (
    <>
      <Substrate />
      <div className="relative z-[2] flex min-h-[100dvh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-[560px]">
          {/* ── what is happening ─────────────────────────────────────── */}
          <div className="eyebrow eyebrow--em mb-5">Indexing</div>

          <h1 className="mb-3 text-[26px] font-semibold leading-[1.12] tracking-[-0.034em] text-ink">
            {failed ? (
              <>Indexing could not <em className="serif-it">complete</em>.</>
            ) : (
              <>Building a <em className="serif-it">verifiable</em> model.</>
            )}
          </h1>
          <p className="mb-8 font-mono text-[12px] text-ink-2">{name}</p>

          {/* ── progress ──────────────────────────────────────────────── */}
          <div className="mb-2 flex items-baseline justify-between">
            <span className={failed ? 'st st--risk' : 'st st--live'}>
              <i />
              {failed ? 'Halted' : `Stage ${Math.max(1, currentIdx + 1)} of 5`}
            </span>
            <span className="font-mono text-[12px] font-medium tabular-nums text-ink">{percent}%</span>
          </div>

          <div className="mb-6 flex gap-1.5" aria-hidden="true">
            {STAGE_ORDER.slice(0, 5).map((key, idx) => {
              const done = !failed && idx < currentIdx;
              const live = !failed && idx === currentIdx;
              const bad = failed && idx === currentIdx;
              return (
                <div key={key} className="h-[5px] flex-1 overflow-hidden rounded-full bg-rule">
                  <div
                    className={`h-full rounded-full ${bad ? 'bg-sig' : done || live ? 'bg-emerald' : 'bg-transparent'}`}
                    style={{ width: done || live || bad ? '100%' : '0%', transition: 'width .45s cubic-bezier(.22,.61,.36,1)' }}
                  />
                </div>
              );
            })}
          </div>

          {/* ── the five real stages ──────────────────────────────────── */}
          <div className="panel mb-5">
            <div className="panel__head">
              <div className="t">
                <span className={failed ? 'st st--risk' : 'st st--live'}>
                  <i />
                  {failed ? 'Index failed' : STAGE_META[stage].label}
                </span>
              </div>
              <div className="r">AST · deterministic</div>
            </div>
            <div className="divide-y divide-rule">
              {STAGE_ORDER.slice(0, 5).map((key, idx) => {
                const done = !failed && idx < currentIdx;
                const live = !failed && idx === currentIdx;
                const bad = failed && idx === currentIdx;
                return (
                  <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[9px] ${
                        bad
                          ? 'bg-sig text-paper-2'
                          : done
                            ? 'bg-emerald text-paper-2'
                            : live
                              ? 'border-[1.5px] border-emerald text-emerald'
                              : 'border border-rule text-ink-3'
                      }`}
                    >
                      {done ? '✓' : bad ? '!' : String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] ${done || live ? 'text-ink' : 'text-ink-2'}`}>
                        {STAGE_META[key].label}
                      </div>
                      <div className="font-mono text-[9px] text-ink-3">{STAGE_META[key].desc}</div>
                    </div>
                    {(done || live) && !bad && (
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.13em] text-ink-3">
                        {done ? 'complete' : 'running'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── real counts, blank until reported ─────────────────────── */}
          {!failed && (chunks != null || stats?.filesProcessed != null) && (
            <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[10.5px] text-ink-2">
              {stats?.filesProcessed != null && (
                <span>
                  Files{' '}
                  <b className="font-medium text-ink">
                    {stats.filesProcessed}
                    {stats?.filesEmbedded ? `/${stats.filesEmbedded}` : ''}
                  </b>
                </span>
              )}
              {chunks != null && (
                <span>
                  Chunks <b className="font-medium text-ink">{chunks}</b>
                </span>
              )}
            </div>
          )}

          {failed && (
            <div className="mb-5 rounded-[3px] border border-[rgba(226,70,47,.3)] bg-[rgba(226,70,47,.07)] px-4 py-3 text-[12.5px] leading-[1.6] text-ink-2">
              {progress?.replace(/^Error:\s*/i, '') || 'The index could not be completed.'}
            </div>
          )}

          {/* ── the way out ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-3">
              {failed ? 'Data stays hidden until an index completes' : 'The dashboard unlocks on completion'}
            </span>
            {failed && (
              <button type="button" className="abtn abtn--solid" onClick={onRetry} disabled={retrying}>
                {retrying ? 'Retrying…' : 'Retry indexing'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default IndexingStageLoader;
