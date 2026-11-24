// Vendored unchanged from clack (alcun/clack, src/lib/cloth.ts, 24 November 2026). Change it there, then copy.
/**
 * A sheet of paper as a soft body, and the renderer that maps a texture over it.
 *
 * Verlet points on a grid, in THREE dimensions. Two dimensions would be
 * cheaper and would look like jelly: a sheet only reads as paper when it bends
 * out of the plane and catches the light differently on each side of the bend,
 * so every point carries a z and every triangle is shaded by its own normal.
 *
 * The other half of "paper, not cloth" is bending constraints. Structural links
 * alone give you a tea towel. Links that skip a point resist folding, which is
 * what makes it fall in long lazy curves instead of crumpling.
 */

export type Cloth = {
  cols: number;
  rows: number;
  w: number;
  h: number;
  n: number;
  x: Float32Array; y: Float32Array; z: Float32Array;
  px: Float32Array; py: Float32Array; pz: Float32Array;
  rx: Float32Array; ry: Float32Array; rz: Float32Array;
  la: Int32Array; lb: Int32Array; ll: Float32Array; lk: Float32Array;
  /** points clamped to rest: the sheet gripped by the platen and the feed rollers */
  pin: Uint8Array;
  /** indices currently pinned, and their offsets from the grab point */
  held: number;
  heldIds: number[];
  heldOff: number[];
  hx: number; hy: number; hz: number;
};

export type ClothTuning = {
  gravity: number;
  damping: number;
  restore: number;
  iterations: number;
};

/** Gripped by the machine: it still flutters, but it snaps back to the lean. */
export const MACHINE_FEEL: ClothTuning = {
  gravity: 0.06,
  damping: 0.955,
  restore: 0.085,
  iterations: 10,
};

export const PAPER_FEEL: ClothTuning = {
  // enough weight to droop and swing, not enough to fall out of view
  gravity: 0.115,
  damping: 0.965,
  // The spring home. Weak enough that a shove flops it about for a moment,
  // firm enough that it is a sheet of paper and not a handkerchief.
  restore: 0.022,
  iterations: 12,
};

export function makeCloth(w: number, h: number, cols = 9, rows = 13): Cloth {
  const n = cols * rows;
  const c: Cloth = {
    cols, rows, w, h, n,
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
    px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n),
    rx: new Float32Array(n), ry: new Float32Array(n), rz: new Float32Array(n),
    la: new Int32Array(0), lb: new Int32Array(0), ll: new Float32Array(0), lk: new Float32Array(0),
    pin: new Uint8Array(n),
    held: -1, heldIds: [], heldOff: [], hx: 0, hy: 0, hz: 0,
  };

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const u = i / (cols - 1);
      const v = j / (rows - 1);
      const px = (u - 0.5) * w;
      const py = (v - 0.5) * h;
      // It has just come off a platen, so it holds a curl. A flat rectangle
      // reads as a card; a sheet with a memory of the roller reads as paper.
      const curl = Math.sin(v * Math.PI) * -10 + (u - 0.5) * (u - 0.5) * 26;
      c.rx[k] = px; c.ry[k] = py; c.rz[k] = curl;
      c.x[k] = px; c.y[k] = py; c.z[k] = curl;
      c.px[k] = px; c.py[k] = py; c.pz[k] = curl;
    }
  }

  const la: number[] = [], lb: number[] = [], ll: number[] = [], lk: number[] = [];
  const link = (a: number, b: number, k: number) => {
    const dx = c.rx[a]! - c.rx[b]!, dy = c.ry[a]! - c.ry[b]!, dz = c.rz[a]! - c.rz[b]!;
    la.push(a); lb.push(b); ll.push(Math.hypot(dx, dy, dz)); lk.push(k);
  };
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i + 1 < cols) link(k, k + 1, 1);
      if (j + 1 < rows) link(k, k + cols, 1);
      if (i + 1 < cols && j + 1 < rows) link(k, k + cols + 1, 0.85);   // shear
      if (i + 2 < cols) link(k, k + 2, 1);                              // bend
      if (j + 2 < rows) link(k, k + 2 * cols, 1);                       // bend
      // Longer-range bends are what stop a corner drag folding the whole page
      // over on itself. Paper resists curvature over a distance; cloth does not.
      if (i + 3 < cols) link(k, k + 3, 1);
      if (j + 3 < rows) link(k, k + 3 * cols, 1);
      if (i + 4 < cols) link(k, k + 4, 0.9);
      if (j + 4 < rows) link(k, k + 4 * cols, 0.9);
    }
  }
  c.la = Int32Array.from(la);
  c.lb = Int32Array.from(lb);
  c.ll = Float32Array.from(ll);
  c.lk = Float32Array.from(lk);
  return c;
}

/** Largest point speed, squared. Used to stop redrawing a settled page. */
export function energy(c: Cloth): number {
  let m = 0;
  for (let i = 0; i < c.n; i++) {
    const dx = c.x[i]! - c.px[i]!, dy = c.y[i]! - c.py[i]!, dz = c.z[i]! - c.pz[i]!;
    const e = dx * dx + dy * dy + dz * dz;
    if (e > m) m = e;
  }
  return m;
}

/**
 * Reshape the rest state.
 *
 * In the machine the sheet is not a free page: it is gripped by the platen and
 * leans away from the typist above the writing line, which is the lean the DOM
 * version faked with a single rotateX. Here it is the rest shape itself, so the
 * paper can lean AND flutter, and so pulling it out is a change of rest rather
 * than a change of renderer.
 */
export function restInMachine(c: Cloth, writeLocalY: number, lean: number, grip = true) {
  const { cols, rows } = c;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const u = i / (cols - 1);
      const v = j / (rows - 1);
      const px = (u - 0.5) * c.w;
      const py = (v - 0.5) * c.h;
      const above = writeLocalY - py;
      // above the writing line it leans back; below it wraps down round the
      // roller and out of sight
      const z = above > 0 ? -above * lean : above * lean * 2.4;
      c.rx[k] = px;
      c.ry[k] = py;
      c.rz[k] = z;
      // everything from the writing line down is held by the machine
      c.pin[k] = grip && py >= writeLocalY - 6 ? 1 : 0;
    }
  }
}

/** A free page: flat, with the curl it kept from the roller. */
export function restFree(c: Cloth) {
  const { cols, rows } = c;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const u = i / (cols - 1);
      const v = j / (rows - 1);
      c.rx[k] = (u - 0.5) * c.w;
      c.ry[k] = (v - 0.5) * c.h;
      c.rz[k] = Math.sin(v * Math.PI) * -10 + (u - 0.5) * (u - 0.5) * 26;
      c.pin[k] = 0;
    }
  }
}

/** Drop the sheet exactly onto its rest shape, with no motion. */
export function settle(c: Cloth) {
  for (let i = 0; i < c.n; i++) {
    c.x[i] = c.rx[i]!; c.y[i] = c.ry[i]!; c.z[i] = c.rz[i]!;
    c.px[i] = c.rx[i]!; c.py[i] = c.ry[i]!; c.pz[i] = c.rz[i]!;
  }
}

/** A shove, in sheet units per frame. Pinned points ignore it. */
export function kick(c: Cloth, dy: number, dz: number, from = 0) {
  if (calm) return;
  for (let i = from; i < c.n; i++) {
    if (c.pin[i]) continue;
    const r = 0.6 + Math.random() * 0.8;
    c.py[i] = c.y[i]! - dy * r;
    c.pz[i] = c.z[i]! - dz * r;
  }
}

let calm = false;
if (typeof window !== 'undefined') {
  const q = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  calm = !!q?.matches;
  q?.addEventListener?.('change', (e) => { calm = e.matches; });
}

export function step(c: Cloth, t: ClothTuning, time: number) {
  const { x, y, z, px, py, pz, rx, ry, rz } = c;
  const d = t.damping;

  // A breath of air, so a sheet left alone is never completely dead. Off for
  // anyone who has asked for less motion: an idling page that never quite
  // settles is exactly what that setting is about.
  const air = calm ? 0 : Math.sin(time * 0.0011) * 0.007 + Math.sin(time * 0.0027) * 0.004;

  for (let i = 0; i < c.n; i++) {
    if (c.pin[i]) { px[i] = x[i] = c.rx[i]!; py[i] = y[i] = c.ry[i]!; pz[i] = z[i] = c.rz[i]!; continue; }
    if (c.held >= 0 && isHeld(c, i)) continue;
    const vx = (x[i]! - px[i]!) * d;
    const vy = (y[i]! - py[i]!) * d;
    const vz = (z[i]! - pz[i]!) * d;
    px[i] = x[i]!; py[i] = y[i]!; pz[i] = z[i]!;
    x[i] = x[i]! + vx + (rx[i]! - x[i]!) * t.restore;
    y[i] = y[i]! + vy + (ry[i]! - y[i]!) * t.restore + t.gravity;
    z[i] = z[i]! + vz + (rz[i]! - z[i]!) * t.restore + air * (1 + (i % 7) * 0.1);
  }

  if (c.held >= 0) {
    for (let h = 0; h < c.heldIds.length; h++) {
      const i = c.heldIds[h]!;
      px[i] = x[i]!; py[i] = y[i]!; pz[i] = z[i]!;
      x[i] = c.hx + c.heldOff[h * 3]!;
      y[i] = c.hy + c.heldOff[h * 3 + 1]!;
      z[i] = c.hz + c.heldOff[h * 3 + 2]!;
    }
  }

  for (let it = 0; it < t.iterations; it++) {
    for (let l = 0; l < c.la.length; l++) {
      const a = c.la[l]!, b = c.lb[l]!, rest = c.ll[l]!, k = c.lk[l]!;
      let dx = x[b]! - x[a]!, dy = y[b]! - y[a]!, dz = z[b]! - z[a]!;
      const dist = Math.hypot(dx, dy, dz) || 1e-6;
      const diff = ((dist - rest) / dist) * 0.5 * k;
      dx *= diff; dy *= diff; dz *= diff;
      if (!c.pin[a] && !(c.held >= 0 && isHeld(c, a))) { x[a] = x[a]! + dx; y[a] = y[a]! + dy; z[a] = z[a]! + dz; }
      if (!c.pin[b] && !(c.held >= 0 && isHeld(c, b))) { x[b] = x[b]! - dx; y[b] = y[b]! - dy; z[b] = z[b]! - dz; }
    }
  }
}

/** Perspective projection. Sheet units in, screen pixels out. */
export type View = { cx: number; cy: number; scale: number; depth: number };

export function project(c: Cloth, i: number, v: View): [number, number, number] {
  const k = v.depth / (v.depth - c.z[i]!);
  return [v.cx + c.x[i]! * v.scale * k, v.cy + c.y[i]! * v.scale * k, c.z[i]!];
}

/** Nearest point to a screen position, for grabbing. */
export function pick(c: Cloth, sx: number, sy: number, v: View): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < c.n; i++) {
    const [x, y] = project(c, i, v);
    const d = (x - sx) * (x - sx) + (y - sy) * (y - sy);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Hold it the way a hand does. Pinning a single vertex and dragging it across
 * the page nips the sheet at one node and the rest follows like a rag - no
 * amount of stiffness fixes that, because the pinch is real and correctly
 * simulated. Pinning the grabbed point together with its neighbours, rigidly,
 * is finger and thumb, and the page starts behaving like paper being held.
 */
/** Is this screen point on the sheet? Ray-crosses the projected outline. */
export function contains(c: Cloth, sx0: number, sy0: number, v: View): boolean {
  const ring: [number, number][] = [];
  const { cols, rows } = c;
  const at = (i: number) => ring.push([project(c, i, v)[0], project(c, i, v)[1]]);
  for (let i = 0; i < cols; i++) at(i);
  for (let j = 1; j < rows; j++) at(j * cols + cols - 1);
  for (let i = cols - 2; i >= 0; i--) at((rows - 1) * cols + i);
  for (let j = rows - 2; j >= 1; j--) at(j * cols);
  let inside = false;
  for (let i = 0, k = ring.length - 1; i < ring.length; k = i++) {
    const [xi, yi] = ring[i]!;
    const [xk, yk] = ring[k]!;
    if ((yi > sy0) !== (yk > sy0) && sx0 < ((xk - xi) * (sy0 - yi)) / (yk - yi) + xi) inside = !inside;
  }
  return inside;
}

export function grab(c: Cloth, i: number, sx: number, sy: number, v: View) {
  c.held = i;
  const col = i % c.cols;
  const row = Math.floor(i / c.cols);
  c.heldIds = [];
  c.heldOff = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr, q = col + dc;
      if (r < 0 || r >= c.rows || q < 0 || q >= c.cols) continue;
      const k = r * c.cols + q;
      c.heldIds.push(k);
      c.heldOff.push(c.x[k]! - c.x[i]!, c.y[k]! - c.y[i]!, c.z[k]! - c.z[i]!);
    }
  }
  moveGrab(c, sx, sy, v);
}

export function moveGrab(c: Cloth, sx: number, sy: number, v: View) {
  if (c.held < 0) return;
  const k = v.depth / (v.depth - c.z[c.held]!);
  c.hx = (sx - v.cx) / (v.scale * k);
  c.hy = (sy - v.cy) / (v.scale * k);
  c.hz = c.z[c.held]!;
}

export function release(c: Cloth) {
  c.held = -1;
  c.heldIds = [];
  c.heldOff = [];
}

const isHeld = (c: Cloth, i: number) => c.heldIds.includes(i);

/* ------------------------------------------------------------------ render */

type Tri = { a: number; b: number; c: number; z: number };

/**
 * Texture-mapped triangles. Canvas has no perspective-correct mapping, so each
 * quad is split and each triangle gets the affine transform that carries its
 * three texture corners onto its three screen corners, clipped to itself.
 */
function drawTri(
  g: CanvasRenderingContext2D, img: CanvasImageSource,
  u0: number, v0: number, u1: number, v1: number, u2: number, v2: number,
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  grow: number,
) {
  const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
  if (!det) return;

  // Clipping neighbouring triangles on exactly the shared edge leaves a
  // hairline of background between them once antialiased, and a sheet of paper
  // with a grid of pale seams through it is worse than no warp at all. Push
  // each vertex out from the centroid so they overlap.
  const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3;
  // Expand along the real outward direction, not per axis: a sliver triangle
  // barely moves under a per-axis sign and its seam survives.
  const push = (qx: number, qy: number): [number, number] => {
    const dx = qx - mx, dy = qy - my;
    const d = Math.hypot(dx, dy) || 1;
    return [qx + (dx / d) * grow, qy + (dy / d) * grow];
  };
  const p0 = push(x0, y0), p1 = push(x1, y1), p2 = push(x2, y2);

  g.save();
  g.beginPath();
  g.moveTo(p0[0], p0[1]);
  g.lineTo(p1[0], p1[1]);
  g.lineTo(p2[0], p2[1]);
  g.closePath();
  g.clip();

  const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
  const cc = ((u1 - u0) * (x2 - x0) - (u2 - u0) * (x1 - x0)) / det;
  const f = x0 - a * u0 - cc * v0;
  const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
  const e = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
  const gg = y0 - b * u0 - e * v0;

  g.transform(a, b, cc, e, f, gg);
  g.drawImage(img, 0, 0);
  g.restore();
}

/** Reused across frames. Shading is drawn small and blurred, never per triangle. */
let shadeBuf: HTMLCanvasElement | null = null;
const SHADE_DIV = 3;

const LIGHT = (() => {
  const l = [-0.42, -0.5, 0.76];
  const m = Math.hypot(l[0]!, l[1]!, l[2]!);
  return [l[0]! / m, l[1]! / m, l[2]! / m] as const;
})();

export function render(
  g: CanvasRenderingContext2D,
  c: Cloth,
  tex: CanvasImageSource,
  v: View,
  opts: {
    shadow?: boolean;
    width: number;
    height: number;
    /** screen y below which nothing is drawn: the paper is inside the machine */
    clipBelow?: number;
    /** grid row the paper bail presses on, drawn after the sheet so it follows the bend */
    bailRow?: number;
  },
) {
  const { cols, rows } = c;
  const sx = new Float32Array(c.n);
  const sy = new Float32Array(c.n);
  for (let i = 0; i < c.n; i++) {
    const [x, y] = project(c, i, v);
    sx[i] = x; sy[i] = y;
  }

  /** the outline of the mesh, walked as a ring */
  const ring = (g2: CanvasRenderingContext2D, dx = 0, dy = 0, k = 1) => {
    g2.beginPath();
    const at = (i: number, first = false) =>
      first ? g2.moveTo((sx[i]! + dx) * k, (sy[i]! + dy) * k) : g2.lineTo((sx[i]! + dx) * k, (sy[i]! + dy) * k);
    at(0, true);
    for (let i = 1; i < cols; i++) at(i);
    for (let j = 1; j < rows; j++) at(j * cols + cols - 1);
    for (let i = cols - 2; i >= 0; i--) at((rows - 1) * cols + i);
    for (let j = rows - 2; j >= 1; j--) at(j * cols);
    g2.closePath();
  };

  if (opts.clipBelow !== undefined) {
    g.save();
    g.beginPath();
    g.rect(0, 0, opts.width, opts.clipBelow);
    g.clip();
  }

  if (opts.shadow !== false) {
    // A blurred path is the obvious way to do this and it is the single most
    // expensive call in the frame, because the blur runs over the whole
    // bounding box every time. A soft radial ellipse sized to the mesh is
    // indistinguishable at this radius and costs almost nothing.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < c.n; i++) {
      if (sx[i]! < x0) x0 = sx[i]!;
      if (sx[i]! > x1) x1 = sx[i]!;
      if (sy[i]! < y0) y0 = sy[i]!;
      if (sy[i]! > y1) y1 = sy[i]!;
    }
    const cx = (x0 + x1) / 2 + 16;
    const cy = (y0 + y1) / 2 + 34;
    const rx = (x1 - x0) / 2 + 26;
    const ry = (y1 - y0) / 2 + 26;
    // A simulation can always find a way to produce a NaN, and a renderer that
    // throws when it does takes the whole page down for the sake of a shadow.
    const ok = Number.isFinite(cx) && Number.isFinite(cy) && rx > 0 && ry > 0;
    const grad = ok ? g.createRadialGradient(cx, cy, 0, cx, cy, 1) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(0,0,0,0.5)');
      grad.addColorStop(0.62, 'rgba(0,0,0,0.34)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(cx, cy);
      g.scale(rx, ry);
      g.translate(-cx, -cy);
      g.fillStyle = grad;
      g.fillRect(cx - 1, cy - 1, 2, 2);
      g.restore();
    }
  }

  const tris: Tri[] = [];
  for (let j = 0; j + 1 < rows; j++) {
    for (let i = 0; i + 1 < cols; i++) {
      const a = j * cols + i, b = a + 1, d = a + cols, e = d + 1;
      tris.push({ a, b, c: d, z: (c.z[a]! + c.z[b]! + c.z[d]!) / 3 });
      tris.push({ a: b, b: e, c: d, z: (c.z[b]! + c.z[e]! + c.z[d]!) / 3 });
    }
  }
  // painter's algorithm: the far side of a fold goes down first
  tris.sort((p, q) => p.z - q.z);

  const uw = c.w / (cols - 1);
  const vh = c.h / (rows - 1);
  const texW = (tex as HTMLCanvasElement).width;
  const texH = (tex as HTMLCanvasElement).height;
  const su = texW / c.w;
  const sv = texH / c.h;

  const uv = (i: number): [number, number] => [(i % cols) * uw * su, Math.floor(i / cols) * vh * sv];

  // --- pass one: the page itself ------------------------------------------
  for (const t of tris) {
    const [ua, va] = uv(t.a), [ub, vb] = uv(t.b), [uc, vc] = uv(t.c);
    drawTri(g, tex, ua, va, ub, vb, uc, vc,
      sx[t.a]!, sy[t.a]!, sx[t.b]!, sy[t.b]!, sx[t.c]!, sy[t.c]!, 1.35);
  }

  // --- pass two: the light ------------------------------------------------
  // Flat-shading each triangle inside its own clip turns a sheet of paper into
  // a low-poly model: every facet edge shows as a hard crease. The light is
  // therefore painted once, small, and blurred, so the gradient runs smoothly
  // across the facets instead of stopping at each one. It is also much cheaper.
  const bw = Math.max(1, Math.ceil(opts.width / SHADE_DIV));
  const bh = Math.max(1, Math.ceil(opts.height / SHADE_DIV));
  if (!shadeBuf) shadeBuf = document.createElement('canvas');
  if (shadeBuf.width !== bw || shadeBuf.height !== bh) {
    shadeBuf.width = bw;
    shadeBuf.height = bh;
  }
  const sg = shadeBuf.getContext('2d')!;
  sg.setTransform(1, 0, 0, 1, 0, 0);
  sg.clearRect(0, 0, bw, bh);
  const k = 1 / SHADE_DIV;

  for (const t of tris) {
    const ia = t.a, ib = t.b, ic = t.c;
    const ax = c.x[ib]! - c.x[ia]!, ay = c.y[ib]! - c.y[ia]!, az = c.z[ib]! - c.z[ia]!;
    const bx = c.x[ic]! - c.x[ia]!, by = c.y[ic]! - c.y[ia]!, bz = c.z[ic]! - c.z[ia]!;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lambert = nx * LIGHT[0]! + ny * LIGHT[1]! + nz * LIGHT[2]!;
    const shade = Math.max(-0.34, Math.min(0.24, (lambert - 0.8) * 1.15));
    if (Math.abs(shade) < 0.006) continue;
    sg.fillStyle = shade > 0 ? `rgba(255,247,226,${shade})` : `rgba(26,17,6,${-shade})`;
    sg.beginPath();
    sg.moveTo(sx[ia]! * k, sy[ia]! * k);
    sg.lineTo(sx[ib]! * k, sy[ib]! * k);
    sg.lineTo(sx[ic]! * k, sy[ic]! * k);
    sg.closePath();
    sg.fill();
  }

  g.save();
  ring(g, 0, 0);
  g.clip();
  g.filter = 'blur(13px)';
  g.drawImage(shadeBuf, 0, 0, opts.width, opts.height);
  g.restore();

  // The bail is drawn ON the sheet, following the row it presses against, so it
  // stays in the gap between two lines however the paper leans or flutters.
  // The row is FRACTIONAL and interpolated: the mesh is 13 rows over 34 lines,
  // so snapping to the nearest row lands on a line of type about half the time.
  if (opts.bailRow !== undefined) {
    const rf = Math.max(0, Math.min(rows - 1.001, opts.bailRow));
    const j0 = Math.floor(rf);
    const f = rf - j0;
    const j1 = Math.min(rows - 1, j0 + 1);
    const bx: number[] = [];
    const by: number[] = [];
    for (let i = 0; i < cols; i++) {
      const a = j0 * cols + i, b = j1 * cols + i;
      bx.push(sx[a]! + (sx[b]! - sx[a]!) * f);
      by.push(sy[a]! + (sy[b]! - sy[a]!) * f);
    }
    const scale = Math.hypot(bx[cols - 1]! - bx[0]!, by[cols - 1]! - by[0]!) / c.w;
    const trace = (dy: number) => {
      g.beginPath();
      g.moveTo(bx[0]!, by[0]! + dy);
      for (let i = 1; i < cols; i++) g.lineTo(bx[i]!, by[i]! + dy);
    };
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(18,22,21,0.34)';
    g.lineWidth = Math.max(1.5, 10 * scale);
    trace(4 * scale);
    g.stroke();
    const grad = g.createLinearGradient(0, by[0]! - 5 * scale, 0, by[0]! + 5 * scale);
    grad.addColorStop(0, '#f5f8f7');
    grad.addColorStop(0.4, '#bfc7c6');
    grad.addColorStop(1, '#2c3231');
    g.strokeStyle = grad;
    g.lineWidth = Math.max(1.2, 8 * scale);
    trace(0);
    g.stroke();
    for (const u of [0.14, 0.5, 0.86]) {
      const fi = u * (cols - 1);
      const i0 = Math.floor(fi), ff = fi - i0;
      const i1 = Math.min(cols - 1, i0 + 1);
      const px = bx[i0]! + (bx[i1]! - bx[i0]!) * ff;
      const py = by[i0]! + (by[i1]! - by[i0]!) * ff;
      g.fillStyle = '#241f19';
      g.beginPath();
      g.ellipse(px, py, Math.max(4, 22 * scale), Math.max(2.4, 9 * scale), 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  if (opts.clipBelow !== undefined) g.restore();
}
