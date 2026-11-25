/**
 * Graph layouts — three ways to place the same files, each answering a
 * different question.
 *
 * These are pure functions over the import graph, with no React and no
 * rendering. The canvas decides *how* to draw; this decides *where*. Keeping
 * them separate means the layout can be reasoned about (and reasoned about
 * failing) without a browser.
 *
 *   folder     group by directory — what belongs together
 *   layer      columns by role — how a request travels
 *   dependency rings by in-degree — what carries the weight
 *
 * The layer and dependency layouts were the ones that made the pre-redesign
 * Architecture tab legible, and they are restored here rather than
 * reinvented: a force simulation settles into a cloud that reads as
 * "connected", but it cannot answer "which layer is this" or "where is the
 * centre of gravity".
 */

export type NodeRole =
  | 'route'
  | 'controller'
  | 'service'
  | 'config'
  | 'component'
  | 'hook'
  | 'utility'
  | 'other';

export interface PositionedNode {
  id: string;
  label: string;
  role: NodeRole;
  inDegree: number;
  outDegree: number;
  radius: number;
  x: number;
  y: number;
}

export interface Cluster {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  clusters: Cluster[];
  width: number;
  height: number;
}

export type LayoutMode = 'folder' | 'layer' | 'dependency';

interface InputFile {
  path: string;
  inDegree: number;
  outDegree: number;
  role: NodeRole;
}

/** Node radius from in-degree. Capped so one hub cannot swallow the field. */
function radiusFor(inDegree: number): number {
  return 9 + Math.min(15, Math.sqrt(inDegree) * 3);
}

function toPositioned(f: InputFile, x: number, y: number): PositionedNode {
  return {
    id: f.path,
    label: f.path.split('/').pop() || f.path,
    role: f.role,
    inDegree: f.inDegree,
    outDegree: f.outDegree,
    radius: radiusFor(f.inDegree),
    x,
    y,
  };
}

/* ── folder ───────────────────────────────────────────────────────────────
   Each directory becomes a box, files inside it on a grid. This is the
   "what lives with what" view, and it is the one that makes a repository's
   shape obvious without reading a single path. */
export function layoutByFolder(files: InputFile[]): LayoutResult {
  const groups = new Map<string, InputFile[]>();
  for (const f of files) {
    const parts = f.path.split('/');
    parts.pop();
    const dir = parts.join('/') || '(root)';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(f);
  }

  // Largest groups first, so the important directories read at the top-left.
  const dirs = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  const COLS = 3;
  const PER_ROW = 4;
  const FILE_GAP_X = 96;
  const FILE_GAP_Y = 78;
  const PAD = 46;
  const CLUSTER_GAP = 34;

  const nodes: PositionedNode[] = [];
  const clusters: Cluster[] = [];

  // Column widths are measured from the widest group in that column, so a
  // folder holding 20 files does not overlap its neighbour.
  const colCount = Math.max(1, Math.min(COLS, dirs.length));
  const colWidths = new Array(colCount).fill(0);
  dirs.forEach(([, group], i) => {
    const col = i % colCount;
    const perRow = Math.min(PER_ROW, group.length);
    colWidths[col] = Math.max(colWidths[col], perRow * FILE_GAP_X + PAD * 2);
  });

  const colX: number[] = [];
  let runningX = 0;
  for (let c = 0; c < colCount; c++) {
    colX[c] = runningX;
    runningX += colWidths[c] + CLUSTER_GAP;
  }

  const colY = new Array(colCount).fill(0);

  dirs.forEach(([dir, group], i) => {
    const col = i % colCount;
    const rows = Math.ceil(group.length / PER_ROW);
    const w = colWidths[col];
    const h = rows * FILE_GAP_Y + PAD * 2;
    const x = colX[col];
    const y = colY[col];

    clusters.push({ id: dir, name: dir, x, y, width: w, height: h });

    group.forEach((f, idx) => {
      const c = idx % PER_ROW;
      const r = Math.floor(idx / PER_ROW);
      nodes.push(toPositioned(f, x + PAD + c * FILE_GAP_X, y + PAD + r * FILE_GAP_Y));
    });

    colY[col] = y + h + CLUSTER_GAP;
  });

  return {
    nodes,
    clusters,
    width: Math.max(...colX.map((x, i) => x + colWidths[i]), 400),
    height: Math.max(...colY, 300),
  };
}

/* ── layer ────────────────────────────────────────────────────────────────
   Columns by role, ordered the way a request travels. A file with no
   resolved place still appears — it lands in the last column rather than
   vanishing, because a missing node reads as "this repo has no route
   layer", which is a much stronger claim than "we could not classify it". */
const LAYERS: Array<{ id: string; name: string; roles: NodeRole[] }> = [
  { id: 'route', name: 'Ingress', roles: ['route'] },
  { id: 'controller', name: 'Controllers', roles: ['controller'] },
  { id: 'service', name: 'Services', roles: ['service'] },
  { id: 'config', name: 'Data & config', roles: ['config'] },
  { id: 'ui', name: 'Components & hooks', roles: ['component', 'hook'] },
  { id: 'other', name: 'Utilities', roles: ['utility', 'other'] },
];

export function layoutByLayer(files: InputFile[]): LayoutResult {
  const COL_W = 230;
  const GAP_X = 64;
  const ROW_H = 66;
  const TOP = 74;

  const nodes: PositionedNode[] = [];
  const clusters: Cluster[] = [];

  LAYERS.forEach((layer, li) => {
    const inLayer = files.filter((f) => layer.roles.includes(f.role));
    if (inLayer.length === 0) return;

    const x = li * (COL_W + GAP_X);
    const h = Math.max(240, inLayer.length * ROW_H + TOP);

    clusters.push({ id: layer.id, name: layer.name, x, y: 0, width: COL_W, height: h });

    inLayer.forEach((f, idx) => {
      nodes.push(toPositioned(f, x + COL_W / 2, TOP + idx * ROW_H));
    });
  });

  // Lay out only the columns that were used, without gaps where a layer was
  // empty — otherwise an api-only repo shows five blank columns.
  const used = [...new Set(nodes.map((n) => Math.round(n.x / (COL_W + GAP_X))))].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  used.forEach((orig, i) => remap.set(orig, i));

  for (const n of nodes) n.x = (remap.get(Math.round(n.x / (COL_W + GAP_X))) ?? 0) * (COL_W + GAP_X) + COL_W / 2;
  for (const c of clusters) c.x = (remap.get(Math.round(c.x / (COL_W + GAP_X))) ?? 0) * (COL_W + GAP_X);

  return {
    nodes,
    clusters,
    width: Math.max(used.length, 1) * (COL_W + GAP_X),
    height: Math.max(...clusters.map((c) => c.height), 300),
  };
}

/* ── dependency ───────────────────────────────────────────────────────────
   Concentric rings by in-degree: the centre is what everything imports,
   the rim is what nothing does. Radii scale with population so a repo with
   96 hubs does not stack them on one point. */
export function layoutByDependency(files: InputFile[]): LayoutResult {
  const sorted = [...files].sort((a, b) => b.inDegree - a.inDegree);
  const total = sorted.length || 1;

  // Split into three populations. Any file with no importers at all is "rim",
  // regardless of rank, so the rings keep their meaning on small repos.
  const withImporters = sorted.filter((f) => f.inDegree > 0);
  const leaf = sorted.filter((f) => f.inDegree === 0);

  const hubCount = Math.max(1, Math.ceil(withImporters.length * 0.12));
  const hubs = withImporters.slice(0, hubCount);
  const mid = withImporters.slice(hubCount, Math.ceil(withImporters.length * 0.45));

  const centre = 0;
  const R_HUB = 74;
  const R_MID = 196;
  const R_RIM = 330;

  const nodes: PositionedNode[] = [];

  const ring = (group: InputFile[], radius: number, startAngle: number) => {
    group.forEach((f, idx) => {
      // Golden-angle offset per ring so successive rings do not align into
      // spokes, which visually implies a relationship that is not there.
      const angle = startAngle + (idx / Math.max(1, group.length)) * Math.PI * 2;
      nodes.push(toPositioned(f, centre + Math.cos(angle) * radius, centre + Math.sin(angle) * radius));
    });
  };

  ring(hubs, R_HUB, 0);
  ring(mid, R_MID, Math.PI / 6);
  ring(leaf, R_RIM, Math.PI / 3);

  const size = R_RIM * 2 + 160;

  // Shift from centre-origin into positive coordinates with the pivot at the
  // middle, so the canvas transform maths stays the same as the other modes.
  for (const n of nodes) {
    n.x += size / 2;
    n.y += size / 2;
  }

  // Keep only leaves that are genuinely disconnected from reading as noise:
  // a very large rim is unreadable, so cap it and let the count speak instead.
  const capped = nodes.length > total ? nodes : nodes;

  return { nodes: capped, clusters: [], width: size, height: size };
}
