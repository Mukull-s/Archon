import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { toast } from 'sonner';
import ModuleGraphCanvas from './ModuleGraphCanvas';
import { getDependencies, getDependents, classifyFile } from './graph/graphQueries';
import { formatBytes } from './explorer/explorerUtils';

/**
 * CodeGraph — the Architecture tab (03).
 *
 * Two halves, and the split is the point:
 *
 *   · The plate. Every file, positioned by a force simulation over the real
 *     import graph and drawn on a deep-space ground. See `ModuleGraphCanvas`
 *     for why leaves fade and the hub's edges are bundled.
 *
 *   · The ranked list. The graph shows shape; this shows rank. A reader who
 *     wants "which files actually hold this repo up" gets an ordered answer
 *     instead of eyeballing node sizes.
 *
 * Both read the same two sources — `dependencyGraph` and `astMetadata` — and
 * the insights fetch supplies the two flags worth colouring (cycles and drift).
 * Nothing here is derived from anything but those.
 */

interface CodeGraphProps {
  repositoryId: string;
  scannedFiles: { path: string; size?: number; lines?: number }[];
  dependencyGraph: Record<string, string[]>;
  astMetadata?: Record<string, { imports?: string[]; exports?: string[]; functions?: string[]; classes?: string[] }>;
  investigationTarget?: string | null;
  setInvestigationTarget?: (target: string) => void;
}

interface Insights {
  circularDependencies?: string[][];
  architecturalDrift?: Array<{ filePath: string }>;
  deadCode?: string[];
  centralityHotspots?: Array<{ filePath: string; inDegree: number }>;
}

export default function CodeGraph({
  repositoryId,
  scannedFiles,
  dependencyGraph,
  astMetadata,
  investigationTarget,
  setInvestigationTarget,
}: CodeGraphProps) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const fetchInsights = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setFailed(false);
    }
    try {
      const { data } = await api.get(`/repos/${repositoryId}/insights`);
      setInsights(data.data);
    } catch (err) {
      console.error('Failed to load insights for graph:', err);
      setFailed(true);
      toast.error('Could not load structural insights.');
    } finally {
      setLoading(false);
    }
  }, [repositoryId]);

  useEffect(() => {
    // Deferred by a tick so the request (and its `setLoading`) lands after the
    // first paint rather than during it.
    const t = setTimeout(() => fetchInsights(true), 0);
    return () => clearTimeout(t);
  }, [fetchInsights]);

  /* ── rank the files by real in-degree ──────────────────────────────────
     Computed from `dependencyGraph` directly rather than from the insights
     endpoint, so it is correct even when that request fails. */
  const ranked = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of scannedFiles) counts.set(f.path, 0);
    for (const [, targets] of Object.entries(dependencyGraph ?? {})) {
      for (const t of targets ?? []) {
        if (counts.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .map(([path, inDegree]) => ({ path, inDegree }))
      .filter((f) => f.inDegree > 0)
      .sort((a, b) => b.inDegree - a.inDegree)
      .map((f) => ({ ...f, share: f.inDegree / max }));
  }, [scannedFiles, dependencyGraph]);

  const visibleRanked = showAll ? ranked : ranked.slice(0, 8);

  /* ── the two flags worth colouring ─────────────────────────────────── */
  const cyclicFiles = useMemo(() => {
    const flat = new Set<string>();
    for (const cycle of insights?.circularDependencies ?? []) {
      for (const f of cycle) flat.add(f);
    }
    return [...flat];
  }, [insights]);

  const criticalFiles = useMemo(() => {
    const flat = new Set<string>();
    for (const d of insights?.architecturalDrift ?? []) flat.add(d.filePath);
    return [...flat];
  }, [insights]);

  const cycleCount = (insights?.circularDependencies ?? []).length;
  const driftCount = criticalFiles.length;

  /* ── the side rail ─────────────────────────────────────────────────────
   * Selecting a node opens a rail describing it. Everything shown is real:
   * the file's own resolved imports and dependents (via the shared graph
   * traversals), its symbols as the parser recorded them, and whether the
   * insights scan flagged it. There is deliberately no generated prose — the
   * old release branch filled this panel with filename-matched boilerplate
   * ("Exposes API routes and controller bindings…") that described nothing.
   */
  const [railOpen, setRailOpen] = useState(false);

  const selectedPath = investigationTarget ?? null;

  const rail = useMemo(() => {
    if (!selectedPath) return null;
    const path = selectedPath.replace(/\\/g, '/');
    const deps = getDependencies(dependencyGraph, path);
    const dependents = getDependents(dependencyGraph, path);
    const ast = astMetadata?.[path];
    const file = scannedFiles.find((f) => f.path.replace(/\\/g, '/') === path);

    const symbols = {
      functions: ast?.functions ?? [],
      classes: ast?.classes ?? [],
      exports: ast?.exports ?? [],
    };

    return {
      path,
      role: classifyFile(path),
      imports: deps,
      dependents,
      symbols,
      symbolCount:
        symbols.functions.length + symbols.classes.length + symbols.exports.length,
      sizeLabel: file?.size != null ? formatBytes(Number(file.size)) : null,
      onCycle: cyclicFiles.includes(path),
      isCritical: criticalFiles.includes(path),
    };
  }, [selectedPath, dependencyGraph, astMetadata, scannedFiles, cyclicFiles, criticalFiles]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-none flex-wrap items-end justify-between gap-6">
        <div className="max-w-[62ch]">
          <div className="eyebrow">Architecture</div>
          <h1 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.034em] text-ink">
            The import graph, positioned by <em className="serif-it">coupling</em>.
          </h1>
          <p className="mt-2.5 text-[13px] leading-[1.6] text-ink-2">
            Each node is a file the parser read; each edge is an import it resolved. Position comes
            from a force simulation over those edges, so clusters sit where modules genuinely depend
            on each other — not where the folders say.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cycleCount > 0 && <span className="st st--risk"><i />{cycleCount} cycles</span>}
          {driftCount > 0 && <span className="st st--warn"><i />{driftCount} drift</span>}
          {cycleCount === 0 && driftCount === 0 && !loading && (
            <span className="st st--ok"><i />No cycles</span>
          )}
          {failed && (
            <button type="button" onClick={() => fetchInsights(false)} className="abtn abtn--ghost !py-1.5">
              Retry insights
            </button>
          )}
        </div>
      </div>

      {/* ── the plate and the rail ─────────────────────────────────────── */}
      <div className={`flex min-h-[420px] flex-1 gap-4 ${rail && railOpen ? 'flex-col xl:flex-row' : ''}`}>
        <div className="flex min-h-[420px] min-w-0 flex-1 flex-col">
          <ModuleGraphCanvas
            scannedFiles={scannedFiles}
            dependencyGraph={dependencyGraph}
            astMetadata={astMetadata}
            investigationTarget={investigationTarget}
            onSelectFile={(path) => {
              setInvestigationTarget?.(path);
              setRailOpen(true);
            }}
            onClearSelection={() => setRailOpen(false)}
            hideDetailPlate={railOpen}
            criticalFiles={criticalFiles}
            cyclicFiles={cyclicFiles}
            loading={loading}
          />
        </div>

        {/* ── the rail: what the selected file actually is ─────────────── */}
        {rail && railOpen && (
          <aside className="flex w-full flex-none flex-col overflow-hidden rounded-[4px] border border-rule bg-paper-2 xl:w-[340px]">
            <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3.5">
              <div className="min-w-0">
                <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  {rail.role} · selected file
                </div>
                <h2 className="mt-1.5 break-all font-mono text-[12px] leading-[1.5] text-ink">
                  {rail.path}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                aria-label="Close file details"
                className="flex-none rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] text-ink-3 transition-colors hover:bg-paper-3 hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* flags — only when the insights scan actually flagged it */}
              {(rail.onCycle || rail.isCritical) && (
                <div className="flex flex-wrap gap-2 border-b border-rule px-4 py-3">
                  {rail.onCycle && <span className="st st--risk"><i />Import cycle</span>}
                  {rail.isCritical && <span className="st st--warn"><i />Flagged drift</span>}
                </div>
              )}

              {/* counts */}
              <div className="grid grid-cols-3 border-b border-rule">
                {([
                  ['Importers', rail.dependents.length],
                  ['Imports', rail.imports.length],
                  ['Symbols', rail.symbolCount],
                ] as const).map(([k, v], i) => (
                  <div key={k} className={`px-4 py-3.5 ${i < 2 ? 'border-r border-rule' : ''}`}>
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3">{k}</div>
                    <div className="mt-1 font-mono text-[19px] leading-none text-ink">{v}</div>
                  </div>
                ))}
              </div>

              {rail.sizeLabel && (
                <div className="border-b border-rule px-4 py-2.5 font-mono text-[10px] text-ink-3">
                  Size on disk · {rail.sizeLabel}
                </div>
              )}

              {/* dependents — who breaks if this changes */}
              <div className="border-b border-rule px-4 py-3.5">
                <div className="mb-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  Imported by {rail.dependents.length > 0 ? `(${rail.dependents.length})` : ''}
                </div>
                {rail.dependents.length === 0 ? (
                  <p className="font-mono text-[10.5px] leading-[1.6] text-ink-3">
                    Nothing in this repository imports this file, so changing it cannot break
                    another module through an import.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {rail.dependents.slice(0, 12).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setInvestigationTarget?.(d)}
                        className="block w-full truncate rounded-[2px] px-1.5 py-1 text-left font-mono text-[10.5px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                      >
                        {d}
                      </button>
                    ))}
                    {rail.dependents.length > 12 && (
                      <div className="px-1.5 pt-1 font-mono text-[9.5px] text-ink-3">
                        +{rail.dependents.length - 12} more
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* imports — what this file depends on */}
              <div className="border-b border-rule px-4 py-3.5">
                <div className="mb-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                  Imports {rail.imports.length > 0 ? `(${rail.imports.length})` : ''}
                </div>
                {rail.imports.length === 0 ? (
                  <p className="font-mono text-[10.5px] leading-[1.6] text-ink-3">
                    No resolved import to another file in this repository.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {rail.imports.slice(0, 12).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setInvestigationTarget?.(d)}
                        className="block w-full truncate rounded-[2px] px-1.5 py-1 text-left font-mono text-[10.5px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink"
                      >
                        {d}
                      </button>
                    ))}
                    {rail.imports.length > 12 && (
                      <div className="px-1.5 pt-1 font-mono text-[9.5px] text-ink-3">
                        +{rail.imports.length - 12} more
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* declared symbols, straight from the parser */}
              {rail.symbolCount > 0 && (
                <div className="px-4 py-3.5">
                  <div className="mb-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-3">
                    Declared symbols
                  </div>
                  <div className="space-y-0.5">
                    {([
                      ['fn', rail.symbols.functions],
                      ['cls', rail.symbols.classes],
                      ['exp', rail.symbols.exports],
                    ] as const).flatMap(([kind, list]) =>
                      list.slice(0, 8).map((name) => (
                        <div key={`${kind}:${name}`} className="flex items-baseline gap-2 py-0.5">
                          <span className="w-7 flex-none font-mono text-[8.5px] uppercase text-ink-3">{kind}</span>
                          <span className="truncate font-mono text-[10.5px] text-ink-2">{name}</span>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── rank, beneath the shape ────────────────────────────────────── */}
      <div className="panel flex-none">
        <div className="panel__head">
          <div className="t">Most imported files</div>
          <div className="r">
            {ranked.length} of {scannedFiles.length} ranked by in-degree
          </div>
        </div>

        {ranked.length === 0 ? (
          <div className="panel__body">
            <p className="font-mono text-[10.5px] text-ink-3">
              No import resolved to another file in this repository, so there is no ranking to
              show. The graph above reflects that.
            </p>
          </div>
        ) : (
          <>
            <div>
              {visibleRanked.map((f, i) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setInvestigationTarget?.(f.path)}
                  className={`hotrow w-full text-left transition-colors hover:bg-paper-3 ${
                    investigationTarget === f.path ? 'bg-paper-3' : ''
                  }`}
                >
                  <span className="rk">{String(i + 1).padStart(2, '0')}</span>
                  <span className="p">{f.path}</span>
                  <span className="deg">{f.inDegree}</span>
                  <span className="cents">
                    {Math.round(f.share * 100)}%
                  </span>
                  <span
                    className="bar"
                    aria-hidden="true"
                    style={{ opacity: 0.9 }}
                  >
                    <i style={{ width: `${Math.max(2, f.share * 100)}%` }} />
                  </span>
                </button>
              ))}
            </div>
            {ranked.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full border-t border-rule px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-3 transition-colors hover:text-ink"
              >
                {showAll ? 'Show fewer' : `Show all ${ranked.length}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
