/**
 * ModuleGraphCanvas — the Architecture tab's plate.
 *
 * Renders the repository's real import graph as a settled field of file nodes
 * on a deep-space ground. Everything on screen comes from `dependencyGraph` and
 * `astMetadata`; nothing is invented, and nothing is drawn that the parser did
 * not resolve.
 *
 * ── the three problems this exists to solve ──────────────────────────────
 *
 * 1. HAIRBALL. In the expressjs/express index, 104 of 142 files have in-degree
 *    0 — they neither import nor are imported. Drawing them at full strength
 *    buried the 38 files that carry the architecture. They are still drawn
 *    (the file count on screen stays honest) but at 12% opacity, out at the rim,
 *    so the connected core reads immediately.
 *
 * 2. STARBURST. `index.js` is imported by 96 files; the next highest is 10.
 *    Drawn to scale its disc swallows the view, and 96 separate curves converge
 *    into a sunburst. Its radius is capped and its edges are bundled into a few
 *    weighted ribbons, so the *fact* (96 importers) still reads without the
 *    picture being destroyed by it.
 *
 * 3. STICKY BALLOONS. A live force simulation never holds still, so nodes chase
 *    each other under the cursor and zoom feels unanchored. Here the layout is
 *    solved once and frozen; motion only comes from the user.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  solveLayout,
  radiusFor,
  hopDistances,
  DEFAULT_TUNING,
  type ForceNode,
  type ForceLink,
} from './graph/forceLayout';
import { renderBackdrop, BACKDROP_BASE } from './graph/SpaceBackdrop';

/* ── palette ───────────────────────────────────────────────────────────────
   One accent (mint) marks the load-bearing core. Everything else is neutral,
   because on this surface colour has to mean something. */
const C = {
  hub: '#25d0a0',
  hubGlow: '37,208,160',
  core: '#4f9c85',
  leaf: '#5b6472',
  signal: '#e2462f',
  amber: '#b87a12',
  label: '#c9d2de',
  labelSoft: 'rgba(180,192,208,0.55)',
  edge: 'rgba(150,166,190,0.13)',
  edgeHot: 'rgba(37,208,160,0.34)',
};

export interface ModuleGraphCanvasProps {
  /** Real files from the repository scan. */
  scannedFiles: Array<{ path: string; size?: string | number; lines?: number }>;
  /** Real resolved imports: path → paths it imports. */
  dependencyGraph: Record<string, string[]>;
  /** Real AST metadata per file, as the parser wrote it. */
  astMetadata?: Record<string, AstEntry>;
  /** Pre-selected file, written by other tabs. */
  investigationTarget?: string | null;
  onSelectFile?: (filePath: string) => void;
  /** Fires with null when the selection is cleared, so an owning rail can close. */
  onClearSelection?: () => void;
  /**
   * The selected file, when the parent owns the selection (to drive a side rail).
   * When provided, the canvas follows it instead of its own internal state, and
   * the floating detail plate is suppressed — the rail is the detail surface.
   */
  selectedFile?: string | null;
  /** Hide the built-in floating detail plate (used when a side rail shows it). */
  hideDetailPlate?: boolean;
  /** Files flagged CRITICAL by the insights scan. */
  criticalFiles?: string[];
  /** Files on an import cycle. */
  cyclicFiles?: string[];
  loading?: boolean;
}

interface AstEntry {
  imports?: string[];
  exports?: string[];
  functions?: string[];
  classes?: string[];
}

type Mode = 'all' | 'core' | 'focus';

export default function ModuleGraphCanvas({
  scannedFiles,
  dependencyGraph,
  astMetadata,
  investigationTarget,
  onSelectFile,
  onClearSelection,
  selectedFile,
  hideDetailPlate = false,
  criticalFiles = [],
  cyclicFiles = [],
  loading = false,
}: ModuleGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLCanvasElement | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>('all');
  const [internalSelected, setSelected] = useState<string | null>(investigationTarget ?? null);
  // When the parent owns the selection (to drive a side rail) the canvas follows
  // it; otherwise it keeps its own. One source of truth either way.
  const controlled = selectedFile !== undefined;
  const selected = controlled ? (selectedFile ?? null) : internalSelected;
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  const drag = useRef<{ active: boolean; moved: boolean; x: number; y: number }>({
    active: false,
    moved: false,
    x: 0,
    y: 0,
  });
  /** Mirrors `drag.current.active` for rendering. A ref cannot be read during
   *  render, and the cursor class needs to react to drags. */
  const [dragging, setDragging] = useState(false);

  /* ── build the graph from real data ───────────────────────────────────── */
  const graph = useMemo(() => {
    const paths = new Set(scannedFiles.map((f) => f.path));
    const inDeg = new Map<string, number>();
    const outDeg = new Map<string, number>();
    for (const f of scannedFiles) {
      inDeg.set(f.path, 0);
      outDeg.set(f.path, 0);
    }

    const links: ForceLink[] = [];
    for (const [src, targets] of Object.entries(dependencyGraph ?? {})) {
      if (!paths.has(src)) continue;
      for (const tgt of targets ?? []) {
        // Only edges that resolve to a file we actually scanned. An unresolved
        // specifier is a fact about the parser, not an edge in this graph.
        if (!paths.has(tgt) || tgt === src) continue;
        links.push({ source: src, target: tgt });
        outDeg.set(src, (outDeg.get(src) ?? 0) + 1);
        inDeg.set(tgt, (inDeg.get(tgt) ?? 0) + 1);
      }
    }

    const maxIn = Math.max(0, ...inDeg.values());
    const nodes: ForceNode[] = scannedFiles.map((f) => ({
      id: f.path,
      inDegree: inDeg.get(f.path) ?? 0,
      outDegree: outDeg.get(f.path) ?? 0,
      group: f.path.includes('/') ? f.path.split('/')[0] : 'root',
      x: 0,
      y: 0,
      r: radiusFor(inDeg.get(f.path) ?? 0, maxIn),
    }));

    // adjacency (undirected) for focus mode
    const adjacency = new Map<string, Set<string>>();
    for (const n of nodes) adjacency.set(n.id, new Set());
    for (const l of links) {
      adjacency.get(l.source)?.add(l.target);
      adjacency.get(l.target)?.add(l.source);
    }

    const connectedCount = nodes.filter((n) => n.inDegree > 0 || n.outDegree > 0).length;
    const isolatedCount = nodes.length - connectedCount;

    return { nodes, links, adjacency, maxIn, connectedCount, isolatedCount };
  }, [scannedFiles, dependencyGraph]);

  /**
   * Solve once per graph/size. Debounced: a window drag fires ResizeObserver
   * dozens of times per second, and re-running 420 relaxation passes each time
   * would stutter the drag.
   */
  const [solveSize, setSolveSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (size.w < 60 || size.h < 60) return;
    const t = setTimeout(() => setSolveSize({ w: size.w, h: size.h }), 120);
    return () => clearTimeout(t);
  }, [size.w, size.h]);

  const laidOut = useMemo(() => {
    if (solveSize.w < 60 || solveSize.h < 60 || graph.nodes.length === 0) return [];
    return solveLayout(
      graph.nodes.map((n) => ({ ...n })),
      graph.links,
      solveSize.w,
      solveSize.h,
      DEFAULT_TUNING,
    );
  }, [graph, solveSize.w, solveSize.h]);

  const nodeById = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);

  /* Which nodes are lit, and at what strength, for the active mode. */
  const focusSet = useMemo(() => {
    if (mode === 'focus' && selected) return hopDistances(selected, 2, graph.adjacency);
    return null;
  }, [mode, selected, graph.adjacency]);

  /* ── size tracking ────────────────────────────────────────────────────── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      const h = Math.floor(entry.contentRect.height);
      // Only commit on a real change. Without this a fractional layout jitter
      // re-renders the whole graph on every observation.
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Rebuild the backdrop only when the plate resizes. */
  useEffect(() => {
    if (size.w < 60 || size.h < 60) return;
    backdropRef.current = renderBackdrop({ width: size.w, height: size.h });
  }, [size.w, size.h]);

  /* ── the renderer ─────────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || size.w < 60 || size.h < 60) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.floor(size.w * dpr)) {
      canvas.width = Math.floor(size.w * dpr);
      canvas.height = Math.floor(size.h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* ground */
    if (backdropRef.current) {
      ctx.drawImage(backdropRef.current, 0, 0, size.w, size.h);
    } else {
      ctx.fillStyle = BACKDROP_BASE;
      ctx.fillRect(0, 0, size.w, size.h);
    }

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);

    const active = hovered ?? selected;
    const hops = (() => {
      if (mode === 'focus' && active) return hopDistances(active, 2, graph.adjacency);
      return focusSet;
    })();

    const critical = new Set(criticalFiles);
    const cyclic = new Set(cyclicFiles);

    /* ── edges ────────────────────────────────────────────────────────────
       Bundled by target. A file imported by 96 others would otherwise draw 96
       near-identical curves; grouping them into a single ribbon per (source
       directory → target) keeps the count truthful while the picture stays
       readable. */
    type Ribbon = { to: ForceNode; from: ForceNode[]; };
    const ribbons = new Map<string, Ribbon>();
    for (const link of graph.links) {
      const s = nodeById.get(link.source);
      const t = nodeById.get(link.target);
      if (!s || !t) continue;
      const bucket = `${link.target}`;
      const existing = ribbons.get(bucket);
      if (existing) existing.from.push(s);
      else ribbons.set(bucket, { to: t, from: [s] });
    }

    for (const { to, from } of ribbons.values()) {
      const dimLeafEdge = to.inDegree === 0 && to.outDegree === 0;

      // how lit is this edge under the active mode?
      let strength = 1;
      if (hops) {
        const hs = hops.get(to.id);
        strength = hs === undefined ? 0 : hs === 0 ? 1 : hs === 1 ? 0.9 : hs === 2 ? 0.5 : 0.14;
      }
      if (mode === 'core' && to.inDegree < 5 && from[0]?.inDegree < 5) strength *= 0.18;

      if (strength <= 0.02) continue;

      const hot = to.inDegree >= 5;
      ctx.strokeStyle = hot ? C.edgeHot : C.edge;
      ctx.globalAlpha = strength * (dimLeafEdge ? 0.5 : 1);
      ctx.lineWidth = Math.min(2.2, 0.6 + Math.log2(1 + from.length) * 0.32);

      // draw the bundle as a single tapered path from the centroid of sources
      let sx = 0;
      let sy = 0;
      for (const f of from) {
        sx += f.x;
        sy += f.y;
      }
      sx /= from.length;
      sy /= from.length;

      const dx = to.x - sx;
      const dy = to.y - sy;
      const bow = 0.075;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + dx / 2 - dy * bow, sy + dy / 2 + dx * bow, to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* ── nodes ────────────────────────────────────────────────────────────
       Painted far-to-near: leaves first, then core, then hubs, so anything
       load-bearing is never covered by a leaf. */
    const order = [...laidOut].sort((a, b) => a.inDegree - b.inDegree);

    for (const n of order) {
      const isLeaf = n.inDegree === 0 && n.outDegree === 0;
      const isHub = n.inDegree >= 20;
      const isCore = n.inDegree >= 5;
      const isActive = active === n.id;
      const isNeighbour = hops?.get(n.id) === 1;

      let alpha = 1;
      if (isLeaf) alpha = hops ? 0.07 : 0.16;               // faded hard, per the brief
      else if (mode === 'core' && !isCore) alpha = hops ? 0.1 : 0.22;
      if (hops && !hops.has(n.id)) alpha = Math.min(alpha, 0.06);

      ctx.globalAlpha = alpha;

      // halo — only for things that carry structural weight
      if (isHub || isCore || isActive) {
        const reach = isHub ? 6.5 : isActive ? 5.5 : 4;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * reach);
        const tint = isHub || isActive ? C.hubGlow : '120,180,160';
        g.addColorStop(0, `rgba(${tint},${isHub ? 0.34 : 0.2})`);
        g.addColorStop(0.45, `rgba(${tint},0.08)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * reach, 0, Math.PI * 2);
        ctx.fill();
      }

      // body
      let fill = C.leaf;
      if (isHub) fill = C.hub;
      else if (isCore) fill = C.core;
      else if (isNeighbour) fill = C.core;
      if (critical.has(n.id)) fill = C.signal;
      else if (cyclic.has(n.id)) fill = C.amber;

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();

      // rim keeps small grey nodes from dissolving into the ground
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.stroke();

      if (isActive) {
        ctx.strokeStyle = 'rgba(37,208,160,0.85)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // labels — budget by importance, never all at once
      const showLabel =
        isHub ||
        isActive ||
        isNeighbour ||
        isCore ||
        (mode !== 'all' && n.inDegree > 0) ||
        (view.k > 1.5 && n.inDegree > 0);

      if (showLabel) {
        const label = n.id.split('/').pop() ?? n.id;
        ctx.textAlign = 'center';
        ctx.font = `${isHub ? 600 : 400} ${isHub ? 12 : 10}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.fillStyle = isHub || isActive ? C.label : isCore ? '#9fe6cd' : C.labelSoft;
        ctx.fillText(label, n.x, n.y + n.r + 14);

        if (isHub) {
          ctx.font = '400 9px "JetBrains Mono", ui-monospace, monospace';
          ctx.fillStyle = 'rgba(37,208,160,0.72)';
          ctx.fillText(`${n.inDegree} importers`, n.x, n.y + n.r + 26);
        }
      }

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [laidOut, nodeById, graph, size, view, mode, selected, hovered, focusSet, criticalFiles, cyclicFiles]);

  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  /* ── interaction ──────────────────────────────────────────────────────── */

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.k,
      y: (clientY - rect.top - view.y) / view.k,
    };
  };

  const pick = (clientX: number, clientY: number): ForceNode | null => {
    const p = toWorld(clientX, clientY);
    // farthest-in wins ties so a small core node is selectable over a leaf
    let best: ForceNode | null = null;
    let bestScore = Infinity;
    for (const n of laidOut) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      const reach = n.r + 8;
      if (d <= reach) {
        const score = d - n.inDegree * 0.2;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, moved: false, x: e.clientX, y: e.clientY };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current.active) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    const id = hit?.id ?? null;
    if (id !== hovered) setHovered(id);
  };

  /** Route every selection change through one place, so controlled and
   *  uncontrolled modes behave identically and the parent is always told. */
  const commitSelection = useCallback(
    (next: string | null) => {
      if (!controlled) setSelected(next);
      if (next === null) onClearSelection?.();
      else onSelectFile?.(next);
    },
    [controlled, onClearSelection, onSelectFile],
  );

  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = drag.current.moved;
    drag.current.active = false;
    setDragging(false);
    if (wasDrag) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit) {
      commitSelection(selected === hit.id ? null : hit.id);
    } else {
      commitSelection(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => {
      const k = Math.max(0.35, Math.min(3.2, v.k * factor));
      const scale = k / v.k;
      return { k, x: mx - (mx - v.x) * scale, y: my - (my - v.y) * scale };
    });
  };

  /** Frame the whole graph — also the reset after panning away. */
  const fit = useCallback(() => {
    if (laidOut.length === 0 || size.w < 60) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of laidOut) {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const pad = 56;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;
    const k = Math.min(size.w / cw, size.h / ch, 1.15);
    setView({
      k,
      x: (size.w - cw * k) / 2 - (minX - pad) * k,
      y: (size.h - ch * k) / 2 - (minY - pad) * k,
    });
  }, [laidOut, size.w, size.h]);

  /**
   * Frame the graph once the first layout exists at a usable size. Guarded by
   * a ref so it runs on the first real solve only — re-framing on every resize
   * would yank the view out from under a user who had just zoomed in.
   */
  const framedRef = useRef(false);
  useEffect(() => {
    if (framedRef.current || laidOut.length === 0 || size.w < 60) return;
    framedRef.current = true;
    fit();
  }, [laidOut, size.w, fit]);

  const sel = selected ? nodeById.get(selected) : null;
  const selImports = sel ? (dependencyGraph[sel.id] ?? []).length : 0;

  return (
    <div className="relative flex min-h-0 w-full flex-1 overflow-hidden">
      {/* ── the field ─────────────────────────────────────────────────── */}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div ref={wrapRef} className="absolute inset-0">
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
            className={dragging ? 'cursor-grabbing' : hovered ? 'cursor-pointer' : 'cursor-grab'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => setHovered(null)}
            onWheel={onWheel}
          />
        </div>

      {/* ── controls ──────────────────────────────────────────────────── */}
      <div className="absolute left-4 top-4 z-[3] flex flex-col gap-1.5">
        {(
          [
            ['all', 'All files', `${graph.nodes.length}`],
            ['core', 'Connected core', `${graph.connectedCount}`],
            ['focus', 'Focus + 2 hops', selected ? '1' : '—'],
          ] as const
        ).map(([m, label, count]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] transition-colors ${
              mode === m
                ? 'border-[rgba(37,208,160,.45)] bg-[rgba(37,208,160,.10)] text-[#25d0a0]'
                : 'border-[#2a2f39] bg-[rgba(12,14,19,.85)] text-[#8b93a1] hover:border-[#3c4350] hover:text-[#c9d2de]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            {label}
            <span className="opacity-55">{count}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={fit}
          className="mt-0.5 flex items-center gap-2 rounded-[3px] border border-[#2a2f39] bg-[rgba(12,14,19,.85)] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.13em] text-[#8b93a1] transition-colors hover:border-[#3c4350] hover:text-[#c9d2de]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          Fit
        </button>
      </div>

      {/* ── legend ────────────────────────────────────────────────────── */}
      <div className="absolute bottom-4 right-4 z-[3] rounded-[3px] border border-[#2a2f39] bg-[rgba(12,14,19,.9)] px-3.5 py-3 backdrop-blur-[3px]">
        <div className="mb-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#5f6672]">
          Reading the field
        </div>
        {(
          [
            [C.hub, 'hub · 20+ importers'],
            [C.core, 'core · 5+ importers'],
            [C.leaf, 'leaf · unconnected'],
            [C.signal, 'on a cycle'],
            [C.amber, 'flagged critical'],
          ] as const
        ).map(([colour, label]) => (
          <div key={label} className="flex items-center gap-2 py-[3px] font-mono text-[9.5px] text-[#8b93a1]">
            <i className="block h-2 w-2 flex-none rounded-full" style={{ background: colour }} />
            {label}
          </div>
        ))}
        <div className="mt-2 border-t border-[#22262e] pt-2 font-mono text-[9px] leading-[1.6] text-[#5f6672]">
          node size = in-degree<br />
          scroll to zoom · drag to pan
        </div>
      </div>

      {/* ── the selected file, as a plate ─────────────────────────────── */}
      {sel && !hideDetailPlate && (
        <div className="absolute bottom-4 left-4 z-[3] w-[292px] overflow-hidden rounded-[3px] border border-[#2a2f39] bg-[rgba(12,14,19,.95)] backdrop-blur-[5px]">
          <div className="flex items-center justify-between gap-3 border-b border-[#22262e] px-3.5 py-2.5">
            <span className="truncate font-mono text-[11px] text-[#eef1f5]">{sel.id}</span>
            <button
              type="button"
              onClick={() => commitSelection(null)}
              aria-label="Clear selection"
              className="flex-none font-mono text-[10px] text-[#5f6672] transition-colors hover:text-[#c9d2de]"
            >
              ✕
            </button>
          </div>
          <div className="px-3.5 py-2.5">
            {(
              [
                ['Importers', String(sel.inDegree), sel.inDegree >= 20],
                ['Imports', String(sel.outDegree), false],
                ['Symbols', String(
                  (astMetadata?.[sel.id]?.functions?.length ?? 0) +
                  (astMetadata?.[sel.id]?.classes?.length ?? 0) +
                  (astMetadata?.[sel.id]?.exports?.length ?? 0),
                ), false],
              ] as const
            ).map(([k, v, hot]) => (
              <div key={k} className="flex items-baseline justify-between py-[5px] font-mono text-[11px]">
                <span className="text-[#5f6672]">{k}</span>
                <span className={hot ? 'text-[#25d0a0]' : 'text-[#c9d2de]'}>{v}</span>
              </div>
            ))}
            {selImports > 0 && (
              <div className="mt-1 border-t border-[#22262e] pt-2">
                <div className="mb-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#5f6672]">
                  Depends on
                </div>
                {(dependencyGraph[sel.id] ?? []).slice(0, 4).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => commitSelection(d)}
                    className="block w-full truncate py-[3px] text-left font-mono text-[10px] text-[#8b93a1] transition-colors hover:text-[#25d0a0]"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── honest data note ──────────────────────────────────────────── */}
      <div className="absolute right-4 top-4 z-[3] text-right font-mono text-[9px] leading-[1.7] text-[#5f6672]">
        <div>
          <span className="text-[#8b93a1]">{graph.nodes.length}</span> files ·{' '}
          <span className="text-[#8b93a1]">{graph.links.length}</span> resolved imports
        </div>
        {graph.isolatedCount > 0 && (
          <div>
            <span className="text-[#8b93a1]">{graph.isolatedCount}</span> with no connections
          </div>
        )}
        {loading && <div className="text-[#25d0a0]">reading insights…</div>}
      </div>
      </div>
    </div>
  );
}