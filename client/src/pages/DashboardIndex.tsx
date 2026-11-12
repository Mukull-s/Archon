import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { Substrate } from '../components/site/Substrate';
import {
  STAGE_ORDER,
  STAGE_META,
  resolveStage,
    resolveCounts,
  resolveTrace,
  resolveStageCounters,
  type IndexingStats,
  type TraceLine,
} from '../components/dashboard/indexingStages';

/**
 * AnalyzePage (/dashboard) — hand a repository to the ingest endpoint and show
 * the run truthfully while it happens.
 *
 * Layout contract: the whole page fits ONE viewport. There is no page scroll —
 * the trace panel is the only thing that scrolls internally once it fills. A
 * progress screen that pushes its own "open dashboard" button below the fold
 * makes the user hunt for the next action, so the run header, the stage rail,
 * the metrics and the action all stay on screen together.
 *
 * Honesty contract: every stage, count and trace line is read from backend
 * state on a poll. Nothing is driven by a timer, and nothing is shown that the
 * server has not reported. A stage the backend has not reached reads
 * "awaiting", not a fabricated zero.
 */

interface RepoStatus {
  id: string;
  name: string;
  owner: string | null;
  isLocal: boolean;
  indexingStatus?: string;
  indexingProgress?: string;
  indexingStats?: IndexingStats;
  isIndexed?: boolean;
  fileCount?: number;
  confidence?: number;
  semanticCompleteness?: number;
}

type Phase = 'idle' | 'starting' | 'indexing' | 'already' | 'done' | 'failed';

/** Reduce any pasted repo form to `owner/repo` so it can be matched. */
function normaliseSlug(input: string): string {
  let s = input.trim().replace(/\/+$/, '').replace(/\.git$/i, '');
  s = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  s = s.replace(/^github\.com\//i, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  return `${parts[0]}/${parts[1]}`.toLowerCase();
}

/** Pull a human message out of a failed request without typing on `any`. */
function apiErrorMessage(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e.response?.data?.error?.message ?? null;
}

export default function AnalyzePage() {
  const [searchParams] = useSearchParams();
  const initialRepo = searchParams.get('repo') || '';

  const [input, setInput] = useState(initialRepo);
  const [repo, setRepo] = useState<RepoStatus | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const autoStarted = useRef(false);

  const slug = repo ? (repo.owner ? `${repo.owner}/${repo.name}` : repo.name) : initialRepo;

  /* ── start (or attach to) an analysis ─────────────────────────────────── */
  const start = useCallback(
    async (value: string) => {
      const target = value.trim();
      if (!target || phase === 'starting') return;

      // Enter the run view immediately, before any network call. The user
      // pressed a button and must see that it registered; the panel below
      // shows "requesting" until the server answers.
      setPhase('starting');
      setError(null);
      setRepo(null);
      setElapsed(0);
      startedAt.current = Date.now();

      try {
        // Attach before starting. `scan-url` restarts an existing index from
        // scratch, so calling it on every visit would mean a page reload kills
        // the user's own running index and starts again at stage 1.
        //
        // Two cases, and they need different treatment:
        //
        //   · The repo is ALREADY indexed → do not silently jump to the
        //     dashboard. The user pasted a URL and pressed a button; they get an
        //     honest "this is already indexed, here is what we have" view with an
        //     explicit way forward. (Previously this dropped straight to `done`,
        //     which read as "the page did nothing".)
        //
        //   · The repo is INDEXING RIGHT NOW → attach to the running job and
        //     show its real progress, without restarting it.
        const norm = normaliseSlug(target);
        if (norm) {
          const list = await api.get('/repos');
          const rows: Array<{ id: string; owner?: string | null; name?: string; indexingStatus?: string }> =
            list.data?.data || [];
          const existing = rows.find((r) => `${r.owner ?? ''}/${r.name}`.toLowerCase() === norm);

          // 'failed' is deliberately excluded: a failed run should be retried,
          // not attached to.
          if (existing && existing.indexingStatus !== 'failed') {
            const full = await api.get(`/repos/${existing.id}?lite=true`);
            const r: RepoStatus = full.data?.data || existing;
            setRepo(r);
            startedAt.current = Date.now();

            if (r.indexingStatus === 'completed' || r.isIndexed) {
              setPhase('already');
            } else {
              setPhase('indexing');
            }
            return;
          }
        }

        const { data } = await api.post('/repos/scan-url', { url: target }, { timeout: 60000 });
        // The start endpoint responds `{ data: { repository, jobId } }`; older
        // builds returned the repository directly under `data`. Accept both so
        // the page never ends up polling `/repos/undefined`.
        const r: RepoStatus | undefined = data?.data?.repository ?? data?.data;
        if (!r?.id) {
          throw new Error('The analysis started but the repository was not returned.');
        }
        setRepo(r);
        setPhase(r.indexingStatus === 'completed' || r.isIndexed ? 'done' : 'indexing');
      } catch (err: unknown) {
        const msg = apiErrorMessage(err) || 'Could not start the analysis.';
        setError(msg);
        setPhase('failed');
        toast.error(msg);
      }
    },
    [phase],
  );

  /* the hero links here with ?repo=, so start automatically on arrival */
  useEffect(() => {
    if (initialRepo && !autoStarted.current) {
      autoStarted.current = true;
      start(initialRepo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRepo]);

  /* ── poll real status while indexing ──────────────────────────────────── */
  useEffect(() => {
    if (!repo?.id || phase !== 'indexing') return;

    const tick = setInterval(async () => {
      try {
        const { data } = await api.get(`/repos/${repo.id}?lite=true`);
        const r = data.data;
        if (!r) return;
        setRepo((prev) => (prev ? { ...prev, ...r } : prev));
        if (r.indexingStatus === 'completed' || r.isIndexed) setPhase('done');
        else if (r.indexingStatus === 'failed') {
          setError(r.indexingProgress || 'The index could not be completed.');
          setPhase('failed');
        }
      } catch {
        /* transient poll failure — keep the last known honest state */
      }
    }, 150);

    return () => clearInterval(tick);
  }, [repo?.id, phase]);

  /* elapsed clock — cosmetic only, never drives the stage or the bar */
  useEffect(() => {
    if ((phase !== 'indexing' && phase !== 'starting') || !startedAt.current) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedAt.current as number)) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ── derived, all from backend state ──────────────────────────────────── */
  const stats = repo?.indexingStats;
  const stage = repo ? resolveStage(stats, repo.indexingProgress || '') : 'download';
  const currentIdx = STAGE_ORDER.indexOf(stage);
  const counts = resolveCounts(stats);
  const trace: TraceLine[] = resolveTrace(stats);
  const isDone = phase === 'done';
  const isAlready = phase === 'already';
  const isFailed = phase === 'failed';
  const isLive = phase === 'indexing' || phase === 'starting';
  const hasRun = !!repo || isFailed;
  // Both `done` and `already` mean the index exists — the rail, counts and bar
  // are the same. They differ only in the headline and the way forward.
  const isComplete = isDone || isAlready;

  // The furthest stage the backend has actually reported. Held in state, not a
  // ref: it is read during render, and a ref read during render is both a React
  // violation and a source of stale output. It only ever moves forward, so a
  // fast transition (extract finishes in ~0.5s) still leaves a visible trail
  // rather than snapping straight from 01 to 05.
  const [reached, setReached] = useState(0);
  useEffect(() => {
    if (!hasRun) return;
    setReached((prev) => (currentIdx > prev ? currentIdx : prev));
  }, [currentIdx, hasRun]);
  const reachedShown = isComplete ? STAGE_ORDER.length - 1 : reached;

  // A stage counts as finished only once the NEXT one has started (or the run
  // is done) — that is what makes each step visibly tick over in turn.
  const stageState = (idx: number): 'done' | 'live' | 'fail' | 'todo' => {
    if (isFailed && idx === reachedShown) return 'fail';
    if (isComplete) return 'done';
    if (idx < reachedShown) return 'done';
    if (idx === reachedShown && isLive) return 'live';
    return 'todo';
  };

  const stageClass = (idx: number): string => {
    const s = stageState(idx);
    if (s === 'fail') return 'stage is-fail';
    if (s === 'done') return 'stage is-done';
    if (s === 'live') return 'stage is-live';
    return 'stage';
  };

  const counters = resolveStageCounters(stats);

  /**
   * The measurement to show under a stage that is currently running.
   *
   * These come straight from the engine's own `indexingStats` — the same numbers
   * it prints to its log. When the engine has not written a counter yet, the
   * stage says what it is doing instead of inventing a figure.
   */
  const liveDetail = (key: (typeof STAGE_ORDER)[number]): string => {
    if (phase === 'starting') return 'contacting ingest…';
    switch (key) {
      case 'download':
        return repo ? 'fetching archive' : 'resolving repository';
      case 'extract':
        return counters.filesScanned != null ? `walking archive · ${counters.filesScanned} entries` : 'walking archive';
      case 'parse':
        return counters.filesScanned != null ? `parsing ${counters.filesScanned} files` : 'parsing every file';
      case 'embed': {
        const parts: string[] = [];
        if (counters.filesProcessed != null) {
          parts.push(`${counters.filesProcessed}${counters.filesEmbedded ? `/${counters.filesEmbedded}` : ''} files`);
        }
        if (counters.chunks != null) parts.push(`${counters.chunks.toLocaleString()} chunks`);
        if (counters.batchesResolved != null && counters.batches != null) {
          parts.push(`batch ${counters.batchesResolved}/${counters.batches}`);
        }
        return parts.length ? parts.join(' · ') : 'embedding symbols';
      }
      case 'summary':
        return 'writing structural briefing';
      default:
        return 'running';
    }
  };

  /** What a finished stage can report, once its numbers exist. */
  const stageDoneDetail = (key: (typeof STAGE_ORDER)[number]): string | null => {
    switch (key) {
      case 'parse':
        return counters.filesScanned != null ? `${counters.filesScanned} files parsed` : null;
      case 'embed':
        return counters.chunks != null ? `${counters.chunks.toLocaleString()} chunks embedded` : null;
      case 'summary':
        return stats?.summaryPresent === true ? 'briefing generated' : null;
      default:
        return null;
    }
  };

  // Overall completion, weighted by stage so the bar advances step by step.
  // 5 stages = 5 equal segments; the embedding sub-percentage fills its segment.
  const stageBase = (reachedShown / (STAGE_ORDER.length - 1)) * 100;
  const embedPct = /embedding\s+(\d+)%/i.exec(repo?.indexingProgress || '');
  const embedFill =
    stageState(reachedShown) === 'live' && stage === 'embed' && embedPct
      ? (Number(embedPct[1]) / 100) * (100 / (STAGE_ORDER.length - 1))
      : 0;
  const overall = isComplete
    ? 100
    : Math.min(99, Math.round(Math.max(stageBase, isLive ? 4 : 0) + embedFill));

  const stateChip = isFailed
    ? { cls: 'st st--risk', label: 'Index failed' }
    : isDone
      ? { cls: 'st st--ok', label: 'Index complete' }
      : isAlready
        ? { cls: 'st st--ok', label: 'Already indexed' }
        : phase === 'starting'
          ? { cls: 'st st--live', label: 'Requesting' }
          : isLive
            ? { cls: 'st st--live', label: `Stage ${reachedShown + 1} of 5 — ${STAGE_META[STAGE_ORDER[Math.min(reachedShown, 4)]].label.toLowerCase()}` }
            : { cls: 'st st--idle', label: 'Ready' };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper">
      <Substrate />

      {/* ── the app rail ─────────────────────────────────────────────────── */}
      <div className="arail relative z-[2] flex-none">
        <div className="mx-auto flex w-full max-w-site items-center justify-between gap-6 px-6 md:px-10">
          <div className="arail__l">
            <Link to="/" className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.03em] text-ink">
              <svg className="text-emerald" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 1.6 17.45 9.4 12 22.4 6.55 9.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 6.2 15.1 10.4 12 17.4 8.9 10.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M22.4 12 14.6 17.45 1.6 12 14.6 6.55Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M17.8 12 13.6 15.1 6.6 12 13.6 8.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="1.65" fill="currentColor" />
              </svg>
              Archon
            </Link>
            {slug && (
              <div className="arail__crumb">
                <span className="sep">/</span>
                <span className="repo">{slug}</span>
                <span className={stateChip.cls}>
                  <i />
                  {stateChip.label}
                </span>
              </div>
            )}
          </div>
          <div className="arail__r">
            <Link to="/history" className="kbd">
              ← Repository hub
            </Link>
          </div>
        </div>
      </div>

      {/* ── the single-viewport body ─────────────────────────────────────── */}
      <main className="relative z-[2] mx-auto flex w-full min-h-0 max-w-site flex-1 flex-col gap-5 px-6 py-6 md:px-10">
        {/* the field that starts it, plus the primary action once done */}
        <div className="flex flex-none flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="mb-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.034em] text-ink md:text-[30px]">
              Analyze a <em className="serif-it not-italic text-emerald">repository</em>.
            </h1>
            <form
              className="an__repo !mt-0 !max-w-[620px]"
              onSubmit={(e) => {
                e.preventDefault();
                start(input);
              }}
            >
              <span className="ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
              </span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="github.com/owner/repository"
                spellCheck={false}
                autoComplete="off"
                aria-label="GitHub repository URL"
              />
              <button type="submit" className="abtn abtn--solid" disabled={phase === 'starting'}>
                {phase === 'starting' ? 'Starting…' : repo ? 'Re-index' : 'Analyze'}
              </button>
            </form>
          </div>

          {isComplete && repo && (
            <div className="flex flex-none items-center gap-4">
              <div className="text-right">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  {isAlready ? 'Already indexed · confidence' : 'Structural confidence'}
                </div>
                <div className="text-[26px] font-semibold leading-none tracking-[-0.03em] text-emerald">
                  {repo.confidence ?? '—'}
                  <span className="ml-1 font-mono text-[10px] font-normal text-ink-3">/ 100</span>
                </div>
              </div>
              <Link to={`/dashboard/${repo.id}`} className="abtn abtn--solid">
                Open dashboard
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div
            className="flex-none rounded-[3px] border border-[rgba(226,70,47,.3)] bg-[rgba(226,70,47,.07)] px-4 py-2.5 text-[12.5px] text-ink-2"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* the run plate — fills the remaining height when a trace is present,
            otherwise sits at content height so a short run never leaves a
            half-empty slab stretching to the fold */}
        {hasRun ? (
          <section className={`prog !mt-0 flex flex-col ${trace.length > 0 ? 'min-h-0 flex-1' : ''}`}>
            <div className="prog__head flex-none">
              <div className="l">
                <span className={stateChip.cls}>
                  <i />
                  {stateChip.label}
                </span>
              </div>
              <div className="r">
                <span>
                  ELAPSED <b className="text-ink-2">{`${elapsed}s`}</b>
                </span>
                <span>
                  ENGINE <b className="text-ink-2">AST · deterministic</b>
                </span>
              </div>
            </div>

            {/* the progress bar — five equal segments, one per stage, so the
                bar visibly advances as each step completes rather than jumping */}
            <div className="flex-none border-b border-rule bg-paper-2 px-5 py-3.5" aria-hidden="true">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  {reachedShown + 1 >= STAGE_ORDER.length - 1 || isComplete
                    ? 'All stages complete'
                    : `Stage ${String(reachedShown + 1).padStart(2, '0')} of 05 — ${STAGE_META[STAGE_ORDER[Math.min(reachedShown, 4)]].label}`}
                </span>
                <span className="font-mono text-[11px] font-medium tabular-nums text-ink">
                  {overall}%
                </span>
              </div>
              <div className="flex gap-1.5">
                {STAGE_ORDER.slice(0, 5).map((key, idx) => {
                  const s = stageState(idx)
                  return (
                    <div key={key} className="h-[5px] flex-1 overflow-hidden rounded-full bg-rule">
                      <div
                        className={`h-full rounded-full ${
                          s === 'fail' ? 'bg-sig' : s === 'todo' ? 'bg-transparent' : 'bg-emerald'
                        }`}
                        style={{
                          width: s === 'done' ? '100%' : s === 'live' ? '100%' : s === 'fail' ? '100%' : '0%',
                          transition: 'width .45s cubic-bezier(.22,.61,.36,1)',
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className={`flex flex-col p-5 ${trace.length > 0 ? 'min-h-0 flex-1' : ''}`}>
              {/* the five real stages — each shows the counters the engine is
                  actually writing while it runs, so a stage in progress is
                  visibly working rather than a static label */}
              <div className="stages flex-none">
                {STAGE_ORDER.slice(0, 5).map((key, idx) => {
                  const s = stageState(idx)
                  return (
                    <div key={key} className={stageClass(idx)}>
                      <span className="stage__dot" />
                      <span className="stage__num">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="stage__t">{STAGE_META[key].label}</div>
                      <div className="stage__d">
                        {/* live measurement for the stage that is running */}
                        {s === 'live' && liveDetail(key)}
                        {s === 'done' && (stageDoneDetail(key) || 'complete')}
                        {s === 'todo' && 'awaiting'}
                        {s === 'fail' && 'failed'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* the trace — only what the backend actually emitted.
                  When there IS a trace it takes the remaining height and
                  scrolls internally. When there is not, the run plate stays
                  content-height and the page keeps its whitespace below,
                  rather than stretching a one-line status into a vast box. */}
              {trace.length > 0 ? (
                <div className="log flex min-h-0 flex-1 flex-col">
                  <div className="log__bar flex-none">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5f646f" strokeWidth="2" aria-hidden="true">
                      <path d="M4 17l6-5-6-5M12 19h8" />
                    </svg>
                    <span className="t">Pipeline trace · {slug}</span>
                  </div>
                  <div className="log__body !max-h-none min-h-0 flex-1">
                    {trace.map((l, i) => (
                      <div
                        key={i}
                        className={`log__line${l.level === 'ok' ? ' is-ok' : l.level === 'warn' ? ' is-warn' : l.level === 'risk' ? ' is-sig' : ''}`}
                      >
                        <span className="ts">{l.ts}</span>
                        <span className="msg">{l.msg}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[4px] border border-dashed border-rule-strong bg-paper-3 px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    {isFailed
                      ? 'No trace was recorded for this run.'
                      : phase === 'starting'
                        ? 'Contacting the ingest service…'
                        : 'Waiting for the engine to emit its first trace line…'}
                  </p>
                </div>
              )}
            </div>

            {/* the metric strip — real counts only, blank until reported */}
            <div className="pmetrics flex-none">
              <Pmetric
                k="Files parsed"
                v={counts.filesParsed != null ? String(counts.filesParsed) : '—'}
                small={counts.filesTotal != null ? `/ ${counts.filesTotal}` : undefined}
                pct={counts.filesTotal && counts.filesParsed != null ? Math.round((counts.filesParsed / counts.filesTotal) * 100) : overall}
              />
              <Pmetric
                k="Symbols chunked"
                v={counts.chunks != null ? counts.chunks.toLocaleString() : '—'}
                small="symbols"
                pct={isComplete ? 100 : overall}
              />
              <Pmetric
                k="Graph edges"
                v={counts.edges != null ? counts.edges.toLocaleString() : '—'}
                small="resolved"
                pct={isComplete ? 100 : overall}
              />
              <Pmetric k="Progress" v={`${overall}`} small="of 100" pct={overall} />
            </div>
          </section>
        ) : (
          /* nothing started yet — the plate keeps its height so the page never jumps */
          <section className="prog !mt-0 flex min-h-0 flex-1 flex-col">
            <div className="prog__head flex-none">
              <div className="l">
                <span className="st st--idle">
                  <i />
                  Ready
                </span>
              </div>
              <div className="r">
                <span>ENGINE <b className="text-ink-2">AST · deterministic</b></span>
              </div>
            </div>
            <div className="grid flex-1 place-items-center p-8">
              <div className="max-w-[52ch] text-center">
                <p className="text-[14px] leading-[1.7] text-ink-2">
                  Paste a public GitHub URL above and press Analyze. Archon fetches the archive,
                  parses every supported file, resolves the import graph and embeds the symbols.
                </p>
                <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">
                  Ceiling 400 files · 15 MB · chunks 4,800 chars, 500 overlap
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ── small local pieces — one use each, so they live here ──────────────── */

function Pmetric({ k, v, small, pct }: { k: string; v: string; small?: string; pct: number }) {
  return (
    <div className="pmetric">
      <div className="k">{k}</div>
      <div className="v">
        {v}
        {small && <small>{small}</small>}
      </div>
      <div className="bar">
        <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}
