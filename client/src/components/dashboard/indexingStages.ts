/**
 * indexingStages — the single source of truth for "where is the index right now".
 *
 * Both surfaces that show indexing progress (the analyse page and the dashboard
 * gate) read the *same* mapping here, so they can never disagree about which
 * stage a repository is in. Previously this logic existed only inside
 * IndexingStageLoader; it is lifted out so the analyse page does not grow a
 * second, subtly different copy.
 *
 * It is driven entirely by backend state (`indexingStatus` / `indexingProgress`
 * / `indexingStats`) — never a client-side timer — so the stage and the
 * percentage are honest. If the backend has not told us a stage yet, we say
 * nothing rather than guessing forward.
 */

export const STAGE_ORDER = ['download', 'extract', 'parse', 'embed', 'summary', 'done'] as const;

export type StageKey = (typeof STAGE_ORDER)[number];

export interface StageMeta {
  /** Human label, title case, as shown on the rail. */
  label: string;
  /** The detail line — what this stage actually does. */
  desc: string;
}

/**
 * The shape of `repository.indexingStats` as the engine writes it. Every field
 * is optional because the backend fills them in progressively — a stage that
 * has not started yet simply has no key, which is how this UI knows to show
 * "awaiting" rather than a fabricated zero.
 */
export interface IndexingStats {
  stage?: string;
  filesProcessed?: number;
  filesEmbedded?: number;
  filesTotal?: number;
  filesScanned?: number;
  filesSkipped?: number;
  chunksTotal?: number;
  chunks?: number;
  edges?: number;
  /** Wall-clock ms for the whole run, present once the engine reports `done`. */
  embedWallMs?: number;
  dbMs?: number;
  apiMs?: number;
  batches?: number;
  batchesResolved?: number;
  batchesFailed?: number;
  retries?: number;
  rateLimits?: number;
  timeouts?: number;
  truncatedByLimit?: boolean;
  summaryPresent?: boolean;
  log?: Array<{ ts?: string; msg?: string; level?: string }>;
}

/**
 * The live figures a stage can show while it is running.
 *
 * Every one of these is written by the engine to `indexingStats` as it works —
 * `filesProcessed` climbs during embed, `chunksTotal` fills in, and so on. They
 * are surfaced so a running stage displays real movement instead of a spinner,
 * which is the difference between a tool that looks trustworthy and one that
 * looks staged.
 */
export interface StageCounters {
  filesProcessed: number | null;
  filesScanned: number | null;
  filesEmbedded: number | null;
  chunks: number | null;
  batches: number | null;
  batchesResolved: number | null;
  retries: number | null;
  rateLimits: number | null;
}

export function resolveStageCounters(stats: IndexingStats | undefined): StageCounters {
  return {
    filesProcessed: stats?.filesProcessed ?? null,
    filesScanned: stats?.filesScanned ?? stats?.filesTotal ?? null,
    filesEmbedded: stats?.filesEmbedded ?? null,
    chunks: stats?.chunksTotal ?? stats?.chunks ?? null,
    batches: stats?.batches ?? null,
    batchesResolved: stats?.batchesResolved ?? null,
    retries: stats?.retries ?? null,
    rateLimits: stats?.rateLimits ?? null,
  };
}

export const STAGE_META: Record<StageKey, StageMeta> = {
  download: { label: 'Download', desc: 'zipball fetched' },
  extract: { label: 'Extract', desc: 'archive walked' },
  parse: { label: 'Parse', desc: 'files → AST' },
  embed: { label: 'Resolve graph + embed', desc: 'chunks embedded' },
  summary: { label: 'Summary', desc: 'structural briefing' },
  done: { label: 'Done', desc: 'index complete' },
};

/** Which stage the backend says we are in. */
export function resolveStage(stats: IndexingStats | undefined, progress: string): StageKey {
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

/**
 * A monotonic 0–100 figure for the progress bar.
 *
 * `embed` is the long stage (tens of seconds), so its reported percentage is
 * mapped into the 30–95 band to stop the bar sitting at 10% for a minute and
 * then leaping. Nothing here is allowed to report 100 until the backend says
 * `done` — a full bar that is not finished is a lie.
 */
export function resolvePercent(stats: IndexingStats | undefined, progress: string): number {
  const m = /(\d+)%/.exec(progress || '');
  if (m) {
    const raw = parseInt(m[1], 10);
    if (/embedding/i.test(progress)) return Math.min(95, 30 + Math.round(raw * 0.65));
    return Math.min(99, Math.max(0, raw));
  }
  const idx = STAGE_ORDER.indexOf(resolveStage(stats, progress));
  return idx <= 0 ? 5 : Math.min(95, Math.round((idx / (STAGE_ORDER.length - 1)) * 95));
}

/** Files parsed / total, when the backend has reported them. */
export function resolveCounts(stats: IndexingStats | undefined) {
  return {
    filesParsed: stats?.filesProcessed ?? null,
    filesTotal: stats?.filesEmbedded ?? stats?.filesTotal ?? null,
    chunks: stats?.chunksTotal ?? stats?.chunks ?? null,
    edges: stats?.edges ?? null,
  };
}

/**
 * The trace lines the backend has actually emitted, older first.
 *
 * `stats.log` is an array of `{ ts, msg, level }` when the engine provides one.
 * When it does not, we return an empty array and the caller shows the stage
 * rail alone — we do not fabricate a terminal transcript.
 */
export interface TraceLine {
  ts: string;
  msg: string;
  level?: 'ok' | 'warn' | 'risk';
}

export function resolveTrace(stats: IndexingStats | undefined): TraceLine[] {
  const raw = stats?.log;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l) => l && typeof l.msg === 'string')
    .map((l): TraceLine => ({
      ts: String(l.ts ?? ''),
      msg: l.msg as string,
      level: (l.level === 'ok' || l.level === 'warn' || l.level === 'risk' ? l.level : undefined) as
        | TraceLine['level'],
    }));
}
