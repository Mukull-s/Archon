/**
 * ForceLayout — positions the repository graph.
 *
 * The simulation is written in the shape of d3-force (many-body repulsion,
 * link springs, centring, collision) but tuned for the data this app actually
 * produces, which is not a typical graph. Measured on expressjs/express:
 *
 *   144 files, 154 resolved imports
 *   104 of them (72%) have in-degree 0 AND out-degree 0 — dead leaves
 *   28 have exactly one edge
 *   1 file is imported 96 times
 *
 * A textbook layout treats all of that as equal mass, so the 104 unattached
 * leaves occupy most of the relaxation budget and the connected core gets
 * compressed into a knot at the centre. The two adjustments below fix that:
 *
 *   • MASS-WEIGHTED REPULSION. A node's repulsion scales with how connected it
 *     is, so the core pushes itself apart while leaves stay small and light.
 *
 *   • RADIAL BIAS BY CONNECTIVITY. Connected files are pulled toward a tighter
 *     orbit; leaves are allowed to sit further out. The result places the
 *     structure in the centre and the noise around it, which is the reading
 *     order a person actually wants.
 *
 * The solve is deterministic (seeded spiral start, no Math.random) and runs to
 * completion before the first paint, so the graph is frozen rather than
 * drifting — a live simulation is what made the earlier version feel sticky.
 */

export interface ForceNode {
  id: string;
  /** How many files import this one. */
  inDegree: number;
  /** How many files this one imports. */
  outDegree: number;
  /** Top-level directory, used for grouping in the layout. */
  group: string;
  x: number;
  y: number;
  /** Drawn radius. Set by `radiusFor` before solving. */
  r: number;
}

export interface ForceLink {
  source: string;
  target: string;
}

export interface ForceTuning {
  /** Base repulsion; scaled per-node by connectivity. */
  repulsion: number;
  linkDistance: number;
  linkStrength: number;
  centering: number;
  gap: number;
  steps: number;
  /**
   * How strongly connected nodes are drawn toward a compact core, and how far
   * unconnected ones are allowed to drift out. 0 disables the radial bias.
   */
  coreTension: number;
  leafReach: number;
}

export const DEFAULT_TUNING: ForceTuning = {
  repulsion: 2200,
  linkDistance: 88,
  linkStrength: 0.055,
  centering: 0.0022,
  gap: 20,
  steps: 520,
  coreTension: 0.035,
  leafReach: 0.85,
};

/**
 * Radius from in-degree.
 *
 * The top of the range is compressed deliberately. Unclamped, a file with 96
 * importers draws roughly six times the radius of one with 10, and its disc
 * swallows the plate. The exact count is always on the label, so the shape only
 * has to rank, not measure.
 */
export function radiusFor(inDegree: number, maxInDegree: number, cap = 22, floor = 3): number {
  if (maxInDegree <= 0) return floor;
  const t = Math.cbrt(Math.min(inDegree, maxInDegree) / maxInDegree);
  return floor + t * (cap - floor);
}

/**
 * Solve a layout inside `width × height`.
 *
 * Returns a new array of nodes with `x`/`y` set. Deterministic: the same graph
 * and the same canvas always produce the same picture.
 */
export function solveLayout(
  nodes: ForceNode[],
  links: ForceLink[],
  width: number,
  height: number,
  tuning: ForceTuning = DEFAULT_TUNING,
): ForceNode[] {
  const n = nodes.length;
  if (n === 0 || width < 40 || height < 40) return nodes;

  const out = nodes.map((node) => ({ ...node }));
  const byId = new Map(out.map((node) => [node.id, node]));

  const edges = links
    .filter((l) => l.source !== l.target && byId.has(l.source) && byId.has(l.target))
    .map((l) => [byId.get(l.source) as ForceNode, byId.get(l.target) as ForceNode] as const);

  const cx = width / 2;
  const cy = height / 2;
  // Fit to the shorter axis so nothing is squeezed on an extreme aspect ratio.
  const usable = Math.min(width, height) * 0.5;

  /* Connectivity weight 0..1, used for both mass and orbit.
     Guarded against missing/NaN degree fields: an unguarded max over an
     undefined field yields NaN, which then silently poisons every coordinate. */
  const safeDeg = (v: number | undefined) => (Number.isFinite(v) ? (v as number) : 0);
  const maxIn = Math.max(0, ...out.map((node) => safeDeg(node.inDegree)));
  const maxOut = Math.max(0, ...out.map((node) => safeDeg(node.outDegree)));
  const weight = new Map<string, number>();
  for (const node of out) {
    const inbound = maxIn > 0 ? safeDeg(node.inDegree) / maxIn : 0;
    const outbound = maxOut > 0 ? safeDeg(node.outDegree) / maxOut : 0;
    // in-degree dominates: being depended on matters more than depending
    weight.set(node.id, Math.max(inbound * 0.85 + outbound * 0.15, 0));
  }

  /* Deterministic start: golden-angle spiral. Even coverage, no clumps, and
     identical on every load — which is what makes a screenshot reproducible. */
  out.forEach((node, i) => {
    const angle = i * 2.399963229728653;
    const radius = Math.sqrt((i + 0.5) / n) * usable * 0.95;
    node.x = cx + Math.cos(angle) * radius;
    node.y = cy + Math.sin(angle) * radius;
  });

  const margin = 34;

  for (let step = 0; step < tuning.steps; step++) {
    // Cool linearly so early passes make big corrections and late passes settle.
    const heat = 1 - step / tuning.steps;

    /* Repulsion between every pair, weighted by how connected each node is.
       An unconnected leaf contributes almost nothing, so it stops crowding the
       core out of the middle. */
    for (let i = 0; i < n; i++) {
      const a = out[i];
      const wa = 0.25 + (weight.get(a.id) ?? 0) * 0.75;
      for (let j = i + 1; j < n; j++) {
        const b = out[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Coincident pair: separate on a fixed diagonal, never at random, so
          // the result stays deterministic.
          dx = (i - j) * 0.5 || 0.5;
          dy = 0.5;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const wb = 0.25 + (weight.get(b.id) ?? 0) * 0.75;
        const f = (tuning.repulsion * wa * wb * heat) / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.x -= fx;
        a.y -= fy;
        b.x += fx;
        b.y += fy;
      }
    }

    /* Springs. The correction is clamped so a node that starts far from its
       neighbour cannot be flung across the canvas in a single pass. */
    for (const [s, t] of edges) {
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      let f = ((d - tuning.linkDistance) * tuning.linkStrength) / d;
      f = Math.max(-0.4, Math.min(0.4, f));
      const fx = dx * f;
      const fy = dy * f;
      s.x += fx;
      s.y += fy;
      t.x -= fx;
      t.y -= fy;
    }

    /* Radial bias: pull connected nodes toward a compact core and let leaves
       occupy the outer band. This is what turns a uniform ball into a
       legible structure-with-surround.

       The orbit is an ELLIPSE matched to the plate, not a circle. A
       hub-and-spoke graph solved on a circle comes out taller than it is wide,
       and the final fit then scales it to the height — leaving a third of a
       wide plate empty. Matching the orbit to the canvas aspect fills it. */
    if (tuning.coreTension > 0) {
      const aspect = width / height;
      const squash = aspect >= 1 ? 1 / Math.sqrt(aspect) : Math.sqrt(1 / aspect);
      for (const node of out) {
        const w = weight.get(node.id) ?? 0;
        const dx = node.x - cx;
        const dy = node.y - cy;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const target = usable * (0.22 + (1 - w) * tuning.leafReach);
        const pull = (dist - target) * tuning.coreTension * heat;
        // horizontal pull is relaxed on a wide plate, vertical on a tall one
        node.x -= (dx / dist) * pull * (aspect >= 1 ? 1 : squash);
        node.y -= (dy / dist) * pull * (aspect >= 1 ? squash : 1);
      }
    }

    /* Gentle global centring, so the system does not drift off the plate. */
    for (const node of out) {
      node.x += (cx - node.x) * tuning.centering * heat;
      node.y += (cy - node.y) * tuning.centering * heat;
    }

    /* Collision — nothing may overlap, so every label stays legible. */
    for (let i = 0; i < n; i++) {
      const a = out[i];
      for (let j = i + 1; j < n; j++) {
        const b = out[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(0.01, Math.hypot(dx, dy));
        const min = a.r + b.r + tuning.gap;
        if (d < min) {
          const push = ((min - d) / d) * 0.5;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
        }
      }
    }
  }

  /* Final fit: scale so the graph FILLS the plate on its limiting axis.
     `Math.min` picks whichever axis is tighter, which is correct, but it means
     a graph whose natural shape is taller than the plate ends up narrow. For a
     hub-and-spoke repository that is most of them. Rather than distort the
     physics to fake width, we scale to fill and accept the aspect the data has
     — the alternative is lying about the layout. */
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of out) {
    minX = Math.min(minX, node.x - node.r);
    maxX = Math.max(maxX, node.x + node.r);
    minY = Math.min(minY, node.y - node.r);
    maxY = Math.max(maxY, node.y + node.r);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const targetW = width - margin * 2;
  const targetH = height - margin * 2;
  const scale = Math.min(targetW / spanX, targetH / spanY);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  for (const node of out) {
    node.x = (node.x - midX) * scale + cx;
    node.y = (node.y - midY) * scale + cy;
    node.r = node.r * Math.min(scale, 1.4);
  }

  return out;
}

/** Neighbours of `startId` by hop distance, up to `depth`. */
export function hopDistances(
  startId: string,
  depth: number,
  adjacency: Map<string, Set<string>>,
): Map<string, number> {
  const hops = new Map<string, number>([[startId, 0]]);
  let frontier = [startId];
  for (let h = 1; h <= depth; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adjacency.get(id) ?? []) {
        if (!hops.has(nb)) {
          hops.set(nb, h);
          next.push(nb);
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return hops;
}
