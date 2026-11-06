/**
 * SpaceBackdrop — the ground the graph floats on.
 *
 * Three parallax layers of stars at different depths, plus two wide nebulae,
 * drawn once into an offscreen canvas and then blitted. Drawing it once matters:
 * a few thousand points repainted at 60fps is the difference between a smooth
 * graph and a hot laptop.
 *
 * The palette is deliberately cool and neutral — deep blue-black to slate, one
 * faint teal nebula and one faint amber one. An earlier pass used a green wash
 * that turned the whole plate into a swimming pool; the node colour is the
 * signal, so the ground must stay quiet underneath it.
 *
 * Determinism: the field is generated from a seeded LCG, so a repository always
 * gets the same sky. It is decoration, but it should not flicker between loads.
 */

export interface BackdropOptions {
  width: number;
  height: number;
  /** Seed so the same view always produces the same sky. */
  seed?: number;
}

/** Deep-space ground: off-black, never pure #000 (pure black kills depth). */
export const BACKDROP_BASE = '#0a0c11';

function makeRandom(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Render the backdrop into a detached canvas.
 *
 * Returns a canvas the caller can `drawImage` at (0,0). Cached by the caller
 * because it only needs rebuilding when the plate resizes.
 */
export function renderBackdrop({ width, height, seed = 20261026 }: BackdropOptions): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const rand = makeRandom(seed);

  /* ── 1. the ground ────────────────────────────────────────────────────
     A single vertical gradient: lighter at the top where the "light source"
     is, falling to near-black at the foot. Gives the plate a horizon. */
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#12151c');
  base.addColorStop(0.45, '#0d0f14');
  base.addColorStop(1, '#08090d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  /* ── 2. nebulae ───────────────────────────────────────────────────────
     Two very wide, very low-opacity radial washes. They are what stop the
     ground reading as a flat fill. Kept desaturated so they never compete
     with the nodes. */
  const nebulae: Array<[number, number, number, string]> = [
    [0.24, 0.22, Math.min(w, h) * 0.62, 'rgba(56,110,120,0.16)'], // cool teal, upper left
    [0.82, 0.76, Math.min(w, h) * 0.54, 'rgba(120,88,54,0.10)'], // warm amber, lower right
    [0.55, 0.48, Math.min(w, h) * 0.44, 'rgba(46,58,92,0.13)'],  // slate blue, centre
  ];
  for (const [px, py, rad, colour] of nebulae) {
    const g = ctx.createRadialGradient(px * w, py * h, 0, px * w, py * h, rad);
    g.addColorStop(0, colour);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ── 3. the starfield, three depths ───────────────────────────────────
     Far stars are small, dim and numerous; near stars are larger and
     brighter but rare. That ratio is what reads as depth. */
  const layers: Array<{ count: number; minR: number; maxR: number; alpha: number }> = [
    { count: 520, minR: 0.25, maxR: 0.6, alpha: 0.20 }, // far
    { count: 190, minR: 0.5, maxR: 1.0, alpha: 0.34 },  // mid
    { count: 46, minR: 0.9, maxR: 1.7, alpha: 0.55 },   // near
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.count; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = layer.minR + rand() * (layer.maxR - layer.minR);
      // a few stars carry a faint chromatic tint instead of pure grey
      const roll = rand();
      const tint = roll > 0.94 ? '186,200,255' : roll > 0.88 ? '255,226,190' : '206,214,228';
      ctx.globalAlpha = layer.alpha * (0.5 + rand() * 0.5);
      ctx.fillStyle = `rgb(${tint})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  /* ── 4. a vignette so the edges settle down ───────────────────────────
     Without it the plate has no boundary and the graph reads as floating in
     an infinite page rather than sitting in a frame. */
  const vignette = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.32,
    w / 2, h / 2, Math.max(w, h) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}
