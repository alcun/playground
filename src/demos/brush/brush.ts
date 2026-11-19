// Vendored from sumicat (MIT) packages/brush/src/brush.ts at e1564a2, via alcun-dev. Change it there, then copy.
// @ts-nocheck
// THE FUDE BRUSH, bbox-local.
//
// A port of alcun-dev/src/lib/enso-render.ts for an infinite canvas. The MATHS
// IS UNCHANGED - every constant, curve and noise input is carried over verbatim
// per SPEC N1. What changed is the coordinate system, and only that:
//
//   old: points normalised 0..1, one square canvas of `size` CSS px, dpr in the
//        dab transform, k = size / REF.
//   new: points in WORLD units, layers sized to the stroke's bbox, `ppw` device
//        pixels per world unit, k = ppw * REF_WORLD / REF.
//
// Three fixes ride along, all documented in SPEC 4.3 and 4.4:
//   1. Paper tooth is sampled in WORLD space, not layer-local space, or the
//      grain travels with each stroke's bounding box and two strokes crossing
//      the same paper disagree about it.
//   2. Hash indices are wrapped, so panning far from the origin does not
//      degrade the hash into banding. All FOUR bilinear corners are wrapped,
//      not just the base index.
//   3. widthHist is a ring buffer rather than two array allocations per segment.
//
// Determinism is the whole architecture (SPEC 3): every noise input is arc
// length in 320-space, a hair index, or a WORLD position in 320-space. No
// Math.random, no Date, no stamp counter. The same points paint the same
// picture at any resolution, forever, which is what lets tiles be thrown away
// and re-baked.

// A recorded sample in WORLD units: [x, y, t]. t = ms from stroke start.
export type Point = [number, number, number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Brush feel constants - IDENTICAL to the web engine. Do not touch (N1).
export const MAX_WIDTH = 22; // slow strokes - thick
export const MIN_WIDTH = 4; // fast strokes - thin
const VMIN = 0.08; // px/ms - considered "slow"
const VMAX = 5.0; // px/ms - considered "fast"
const ROLLING_SIZE = 4; // samples smoothed for width transitions
const REF = 320; // reference scale (px) velocity + width are computed at

// How many WORLD units map to the brush's 320px reference. A constant of the
// product, never the viewport zoom - see SPEC N2. Wire zoom into this and the
// brush becomes a different brush at every zoom level.
//
// A POWER OF TWO on purpose. Scaling a float by 2^n is exact, so converting a
// world coordinate into the brush's 320-space introduces no rounding at all and
// the port is bit-identical to the web engine rather than merely close. 1000
// gave errors around 1e-8 in dab alpha - harmless to look at, but it would have
// meant "identical" could never be asserted, and every future change would have
// had to argue about a tolerance. It also makes re-bakes across the power-of-two
// LOD ladder bit-stable, which is what SPEC 4.6 leans on.
export const REF_WORLD = 1024;

// Bleed and hairs paint outside the point extent, so a stroke's bbox has to be
// padded or the wet fringe is clipped to a straight cut. 320-space figure
// converted to world units (SPEC 4.5).
export const BLEED_PAD = (2 * MAX_WIDTH * REF_WORLD) / REF;

export const PAPERS = [
  { name: "washi white", hex: "#faf6ec" },
  { name: "cream", hex: "#f2e9da" },
  { name: "night indigo", hex: "#2c3350" },
  { name: "sunset", hex: "#f3d9c0" },
  { name: "sumi black", hex: "#1a1815" },
] as const;

export const INKS = [
  { name: "sumi", hex: "#2b2b2b" },
  { name: "indigo", hex: "#3a4a6b" },
  { name: "vermillion", hex: "#b2452c" },
  { name: "pale moon", hex: "#e9e5c9" },
  { name: "gold", hex: "#c9a02c" },
] as const;

export const MIN_CONTRAST = 1.8;

// --- instrumentation --------------------------------------------------------
// Phase 0 has to settle where the cost actually is (SPEC 5), so the brush
// counts what it does. Zero overhead beyond two increments per dab.

export interface Counters {
  segments: number;
  stamps: number;
  drawImage: number;
  dabsSkipped: number; // culled by the alpha/width floor before drawing
  hairsCulled: number; // buried under wet ink, never considered
}

export const counters: Counters = {
  segments: 0,
  stamps: 0,
  drawImage: 0,
  dabsSkipped: 0,
  hairsCulled: 0,
};

export function resetCounters(): void {
  counters.segments = 0;
  counters.stamps = 0;
  counters.drawImage = 0;
  counters.dabsSkipped = 0;
  counters.hairsCulled = 0;
}

// --- velocity curves (verbatim) ---------------------------------------------

function calcVelocity(
  x1: number, y1: number, t1: number, x2: number, y2: number, t2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dt = Math.max(1, t2 - t1);
  return Math.sqrt(dx * dx + dy * dy) / dt;
}

function velocityToWidth(v: number): number {
  const clamped = Math.max(VMIN, Math.min(VMAX, v));
  const t = 1 - (clamped - VMIN) / (VMAX - VMIN);
  return MIN_WIDTH + t * (MAX_WIDTH - MIN_WIDTH);
}

function velocityToOpacity(v: number): number {
  const clamped = Math.max(VMIN, Math.min(VMAX, v));
  const t = 1 - (clamped - VMIN) / (VMAX - VMIN);
  return 0.7 + t * 0.3;
}

// --- the feel, fixed (verbatim) ---------------------------------------------

const FLOW = 0.62;
const INK_SPAN = 1.76;
const KASURE = 0.55;
const GRAIN = 0.35;
const PRESS = 0.3;
const BLEED = 0.35;
const TOOTH = 0.6;

/**
 * The feel, made adjustable.
 *
 * These were compile-time constants and the numbers above are still the only
 * defaults - `DEFAULT_FEEL` reproduces them exactly, so a brush built without a
 * feel stamps byte-identically and Gate 0 is untouched. Nothing here changes
 * unless somebody asks for it.
 *
 * Values are the raw engine numbers, not 0-1 sliders. Naming a control after
 * its intent ("wetness") and mapping that to several of these belongs in the
 * UI, not in the engine: the engine should not have an opinion about which
 * knobs a person thinks of as one idea.
 */
export interface Feel {
  flow: number;
  inkSpan: number;
  kasure: number;
  grain: number;
  press: number;
  bleed: number;
  tooth: number;
  /** Shifts every noise field, so the same stroke frays differently. 0 is the original paper. */
  seed: number;
}

export const DEFAULT_FEEL: Feel = {
  flow: FLOW,
  inkSpan: INK_SPAN,
  kasure: KASURE,
  grain: GRAIN,
  press: PRESS,
  bleed: BLEED,
  tooth: TOOTH,
  seed: 0,
};

const DEP = 0.0045;
const FEED = 0.03;
const INK_GAIN = 1.85;
const RELEASE = 26;
const W_SMOOTH = 7;
const DAB_EFF = 0.6;

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// --- noise, with the wrap and the LUT (SPEC 4.4) ----------------------------

function h1(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function nz(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h1(seed + i * 127.31) * (1 - u) + h1(seed + (i + 1) * 127.31) * u;
}

function fbm(seed: number, x: number): number {
  return nz(seed, x) * 0.65 + nz(seed + 91.7, x * 2.3) * 0.35;
}

function h2(i: number, j: number): number {
  return h1(i * 37.13 + j * 91.71);
}

// The 2D hash grid is wrapped so hash inputs stay bounded however far anyone
// pans. GRID cells per axis; the fine octave (x1.9) repeats every GRID/1.9 =
// 539 units in 320-space, about a thousand wavelengths, and the coarse octave
// (x0.62) every 1651, so the combined tooth only recurs at their common
// multiple. Invisible.
export const GRID = 1024;

function wrapi(i: number): number {
  return i - Math.floor(i / GRID) * GRID;
}

// The reference implementation: wrap all four corners independently. Obviously
// correct, four modulos per sample. The LUT below is tested against this.
function nz2Ref(x: number, y: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const i0 = wrapi(i);
  const j0 = wrapi(j);
  const i1 = wrapi(i + 1);
  const j1 = wrapi(j + 1);
  const a = h2(i0, j0);
  const b = h2(i1, j0);
  const c = h2(i0, j1);
  const d = h2(i1, j1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

// (GRID + 1)^2 with the edge row and column duplicated from index 0, so the hot
// loop reads i+1 and j+1 with no modulo.
//
// FLOAT64, NOT FLOAT32. SPEC 4.4 costed this at 4.2MB as a Float32Array, and
// that is wrong: h2 returns a float64 and storing it as float32 rounds it to
// about seven digits. The error lands in the paper tooth, flows into dab alpha
// and width, and shows up as ~1e-8 divergence from the web engine - which
// breaks the spec's own claim that the LUT is "exactly equivalent, not an
// approximation", and with it the ability to assert dab-for-dab identity at
// all. 1025^2 x 8 bytes = 8.4MB, still nothing against a 250MB budget.
let LUT: Float64Array | null = null;

function buildLUT(): Float64Array {
  const N = GRID + 1;
  const t = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    const jw = j === GRID ? 0 : j;
    for (let i = 0; i < N; i++) {
      const iw = i === GRID ? 0 : i;
      t[j * N + i] = h2(iw, jw);
    }
  }
  return t;
}

function nz2(x: number, y: number): number {
  if (LUT === null) LUT = buildLUT();
  const N = GRID + 1;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const i0 = wrapi(i);
  const j0 = wrapi(j);
  const r0 = j0 * N;
  const r1 = r0 + N;
  const a = LUT[r0 + i0];
  const b = LUT[r0 + i0 + 1];
  const c = LUT[r1 + i0];
  const d = LUT[r1 + i0 + 1];
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

// Exported so the harness can prove the LUT and the reference agree, including
// across a wrap seam where the naive base-index-only wrap reads off the table.
export const _noise = { nz2, nz2Ref, wrapi };

// The paper's surface, sampled in 320-space. The ARGUMENTS ARE WORLD-DERIVED
// (SPEC 4.3) - callers must pass absolute world position converted to
// 320-space, never layer-local pixels, or the grain moves with the bbox.
/**
 * The paper's tooth at a point, in 320-SPACE world coordinates.
 *
 * Exported so other instruments can share the surface. A pencil that samples
 * this skips and darkens over exactly the same grain the brush does, which is
 * what makes two very different marks look like they were made on one sheet.
 */
export function toothAt(xr: number, yr: number): number {
  return nz2(xr * 0.62, yr * 0.62) * 0.55 + nz2(xr * 1.9 + 13.1, yr * 1.9 + 7.7) * 0.45;
}

// --- geometry (verbatim) ----------------------------------------------------

function cr(
  p0: number[], p1: number[], p2: number[], p3: number[], u: number,
): number[] {
  const u2 = u * u;
  const u3 = u2 * u;
  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
  ];
}

function inkProfile(r: number, k: number, taper: number): number {
  if (r >= 1) return 0;
  return Math.min(1, k / Math.sqrt(1 - r * r)) * smoothstep(1, taper, r);
}

const FIBRE = 0.3;
const FIBRE_GAPS = (() => {
  const out: { u: number; hw: number; depth: number }[] = [];
  for (let i = 0; i < 5; i++) {
    out.push({
      u: (h1(i * 19.7 + 2.3) * 2 - 1) * 0.82,
      hw: 0.03 + 0.04 * h1(i * 51.3 + 7.9),
      depth: (0.55 + 0.4 * h1(i * 88.1 + 1.7)) * FIBRE,
    });
  }
  return out;
})();

function fibreAt(dy: number): number {
  let m = 1;
  for (let i = 0; i < FIBRE_GAPS.length; i++) {
    const g = FIBRE_GAPS[i];
    const t = (dy - g.u) / g.hw;
    if (t > -1 && t < 1) {
      const bump = 1 - t * t;
      m *= 1 - g.depth * bump * bump;
    }
  }
  return m;
}

// --- sprites ----------------------------------------------------------------
// 64px regardless of ppw - a dab lands at 10-25px at reference scale and the
// sprite is sampled, not blitted 1:1. Unchanged from the web engine.

type SpriteKind = "body" | "hair" | "bleed";
const spriteCache = new Map<string, HTMLCanvasElement>();

export function clearSpriteCache(): void {
  spriteCache.clear();
}

// Lane enums for the dab stream (SPEC 4.5). Numeric so a stream is one
// contiguous buffer with no per-dab object and no string.
export const LAYER_BLEED = 0;
export const LAYER_INK = 1;
export const SPRITE_BODY = 0;
export const SPRITE_HAIR = 1;
export const SPRITE_BLEED = 2;

/**
 * A sink receives every dab this brush actually STAMPS, in stamp order, as raw
 * numbers. It exists so a stroke's output can be cached and replayed into a tile
 * instead of re-simulated: simulation is stateful along the stroke and cannot be
 * clipped, a replay can.
 *
 * It emits the TANGENT (tx, ty), never an angle. The stamp is
 * `setTransform(tx, ty, -ty, tx, x, y)`, so storing degrees and rebuilding the
 * matrix with cos/sin round-trips the rotation through atan2 and does NOT return
 * the same floats - which breaks SPEC 4.6's same-bytes promise. Dabs the brush
 * skips are never emitted, so a stream holds exactly what was painted.
 */
export type DabSink = (
  layer: number,
  sprite: number,
  x: number,
  y: number,
  tx: number,
  ty: number,
  len: number,
  w: number,
  alpha: number,
) => void;

let DAB_SINK: DabSink | null = null;

/** Install a sink to capture the dab stream, or `null` to stop. */
export function setDabSink(s: DabSink | null): void {
  DAB_SINK = s;
}

/**
 * The three sprite canvases for an ink, in lane order (body, hair, bleed).
 * A replay needs the exact canvases the brush stamped, not equivalent ones.
 */
export function spritesFor(ink: string): HTMLCanvasElement[] {
  return [getSprite(ink, "body"), getSprite(ink, "hair"), getSprite(ink, "bleed")];
}

function getSprite(inkHex: string, kind: SpriteKind): HTMLCanvasElement {
  const key = inkHex + "|" + kind;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const S = 64;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d")!;
  const r = parseInt(inkHex.slice(1, 3), 16);
  const gr = parseInt(inkHex.slice(3, 5), 16);
  const b = parseInt(inkHex.slice(5, 7), 16);
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    const dy = ((y + 0.5) / S) * 2 - 1;
    for (let x = 0; x < S; x++) {
      const dx = ((x + 0.5) / S) * 2 - 1;
      const rad = Math.sqrt(dx * dx + dy * dy);
      let a: number;
      if (kind === "body") a = inkProfile(rad, 0.5, 0.86) * fibreAt(dy);
      else if (kind === "hair") a = inkProfile(rad, 0.78, 0.72);
      else a = Math.pow(clamp(1 - rad, 0, 1), 1.7) * 0.55;
      const i = (y * S + x) * 4;
      d[i] = r;
      d[i + 1] = gr;
      d[i + 2] = b;
      d[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  spriteCache.set(key, cv);
  return cv;
}

// --- the bundle (verbatim) --------------------------------------------------

const HAIR_N = 14;
const CLUMPS = [-0.79, -0.31, 0.2, 0.72];
interface Hair {
  u: number;
  clumped: number;
  ci: number;
  bias: number;
  thick: number;
  seed: number;
}
const HAIRS: Hair[] = (() => {
  const out: Hair[] = [];
  for (let j = 0; j < HAIR_N; j++) {
    const base = ((j + 0.5) / HAIR_N) * 2 - 1;
    const u = clamp(base + (h1(j * 12.9898 + 4.1) - 0.5) * (3.4 / HAIR_N), -1, 1);
    let c = CLUMPS[0];
    let ci = 0;
    for (let q = 0; q < CLUMPS.length; q++) {
      if (Math.abs(CLUMPS[q] - u) < Math.abs(c - u)) {
        c = CLUMPS[q];
        ci = q;
      }
    }
    out.push({
      u,
      clumped: c + (u - c) * 0.12,
      ci,
      bias: clamp(0.82 + 0.36 * h1(j * 71.7 + 3.1) - 0.34 * u * u, 0.2, 1.3),
      thick: 0.55 + 1.5 * Math.pow(h1(j * 23.9 + 11.7), 2),
      seed: 40.1 + j * 137.31,
    });
  }
  return out;
})();

// Total stroke length in 320-space. World deltas scaled by REF / REF_WORLD.
export function arcLength(points: Point[]): number {
  let total = 0;
  const s = REF / REF_WORLD;
  for (let i = 1; i < points.length; i++) {
    const dx = (points[i][0] - points[i - 1][0]) * s;
    const dy = (points[i][1] - points[i - 1][1]) * s;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

// The point extent plus the bleed pad, in world units. This is the box the
// layers get allocated at and the box the spatial index stores.
export const padFor = (size = 1): number => BLEED_PAD * size;

export function strokeBox(points: Point[], pad = BLEED_PAD): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

// ---------------------------------------------------------------------------
// A live stroke. feed() paints only what is newly complete, so a pointermove
// never repaints the stroke; finish() does the one full pass with the release
// taper. Hold one of these for the duration of a stroke, then free it.
// ---------------------------------------------------------------------------

export class EnsoBrush {
  private ctx: CanvasRenderingContext2D;
  private box: Box; // world units, already padded
  private ppw: number; // device px per world unit
  private pxW: number;
  private pxH: number;
  private bleedCtx: CanvasRenderingContext2D;
  private inkCtx: CanvasRenderingContext2D;
  private inkHex = "#2b2b2b";
  private sBody!: HTMLCanvasElement;
  private sHair!: HTMLCanvasElement;
  private sBleed!: HTMLCanvasElement;
  private segIdx = 1;
  private carry = 0;
  private arc = 0;
  private tip = 1;
  private belly = 1;
  private pool = 0;
  // ring buffer - the web engine reallocated two arrays per segment here, which
  // is invisible for one stroke and wasteful across a tile bake of hundreds
  private wHist = new Float64Array(ROLLING_SIZE);
  private wHistN = 0;
  private wHistI = 0;
  private wSm: number | null = null;
  private wPrev: number | null = null;
  private slowPrev = 0;
  private opPrev: number | null = null;
  private tan: [number, number] = [1, 0];
  private lastPos: [number, number] | null = null;
  private spacing = 1;
  private totalArc = Infinity;
  // Brush size. Applied ONLY at the dab transform, never to the 320-space
  // width the ink model runs on, so kasure, depletion and smoothing behave
  // identically at every size - a big brush is the same brush, not a wetter
  // one. size = 1 is the parity default and stamps byte-identically.
  private size = 1;

  private feel: Feel = DEFAULT_FEEL;
  // Every noise field is offset by the same amount, so one seed re-rolls the
  // whole paper coherently rather than shuffling the fields against each other.
  // Zero leaves every field exactly where it was.
  private noiseShift = 0;

  constructor(
    ctx: CanvasRenderingContext2D, box: Box, ppw: number, ink: string,
    size = 1, feel: Feel = DEFAULT_FEEL,
  ) {
    this.ctx = ctx;
    this.box = box;
    this.ppw = ppw;
    this.size = size;
    this.feel = feel;
    this.noiseShift = feel.seed * 137.13;
    this.pxW = Math.max(1, Math.ceil(box.w * ppw));
    this.pxH = Math.max(1, Math.ceil(box.h * ppw));
    // two layers so the wet bleed always sits UNDER the body. Painted into the
    // same canvas it would scallop the stroke's own edge on every stamp.
    this.bleedCtx = this.makeLayer();
    this.inkCtx = this.makeLayer();
    this.begin(ink);
  }

  // device px per 320-space unit. Derived from the bake resolution and a
  // CONSTANT, never from viewport zoom (N2).
  private get k(): number {
    return (this.ppw * REF_WORLD) / REF;
  }

  private makeLayer(): CanvasRenderingContext2D {
    const cv = document.createElement("canvas");
    cv.width = this.pxW;
    cv.height = this.pxH;
    const g = cv.getContext("2d")!;
    return g;
  }

  // Hand the layers back so a caller can flatten them, then free them. SPEC 4.5
  // step 4: a retained layer is retained backing store.
  layers(): [HTMLCanvasElement, HTMLCanvasElement] {
    return [this.bleedCtx.canvas, this.inkCtx.canvas];
  }

  dispose(): void {
    this.bleedCtx.canvas.width = 0;
    this.bleedCtx.canvas.height = 0;
    this.inkCtx.canvas.width = 0;
    this.inkCtx.canvas.height = 0;
  }

  begin(ink: string, totalArc = Infinity): void {
    this.inkHex = ink;
    this.sBody = getSprite(ink, "body");
    this.sHair = getSprite(ink, "hair");
    this.sBleed = getSprite(ink, "bleed");
    this.segIdx = 1;
    this.carry = 0;
    this.arc = 0;
    this.tip = 1;
    this.belly = 1;
    this.pool = 0;
    this.wHistN = 0;
    this.wHistI = 0;
    this.wSm = null;
    this.wPrev = null;
    this.slowPrev = 0;
    this.opPrev = null;
    this.tan = [1, 0];
    this.lastPos = null;
    this.spacing = 1;
    this.totalArc = totalArc;
    this.squareUp();
    this.bleedCtx.clearRect(0, 0, this.pxW, this.pxH);
    this.inkCtx.clearRect(0, 0, this.pxW, this.pxH);
    this.ctx.clearRect(0, 0, this.pxW, this.pxH);
  }

  feed(points: Point[]): void {
    const maxSeg = points.length - 2;
    let painted = false;
    while (this.segIdx <= maxSeg) {
      this.paintSeg(points, this.segIdx);
      this.segIdx++;
      painted = true;
    }
    if (painted) this.flush();
  }

  seal(points: Point[]): void {
    for (let i = this.segIdx; i < points.length; i++) this.paintSeg(points, i);
    this.segIdx = points.length;
    this.flush();
  }

  finish(points: Point[]): void {
    if (!points || points.length < 3) {
      this.begin(this.inkHex);
      return;
    }
    this.begin(this.inkHex, arcLength(points));
    this.seal(points);
  }

  private flush(): void {
    this.squareUp();
    this.ctx.clearRect(0, 0, this.pxW, this.pxH);
    this.ctx.drawImage(this.bleedCtx.canvas, 0, 0);
    this.ctx.drawImage(this.inkCtx.canvas, 0, 0);
  }

  private squareUp(): void {
    this.bleedCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.bleedCtx.globalAlpha = 1;
    this.inkCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.inkCtx.globalAlpha = 1;
  }

  // The web engine kept a plain array and summed it oldest-first. Float
  // addition is not associative, so summing the ring in INDEX order instead of
  // INSERTION order moves the last bits of every width once the ring wraps -
  // which showed up as ~1e-9 alpha drift from about the 64th dab on. Same
  // arithmetic, same order.
  private pushWidth(raw: number): number {
    this.wHist[this.wHistI] = raw;
    this.wHistI = (this.wHistI + 1) % ROLLING_SIZE;
    if (this.wHistN < ROLLING_SIZE) this.wHistN++;
    const n = this.wHistN;
    let s = 0;
    for (let i = 0; i < n; i++) {
      s += this.wHist[(this.wHistI - n + i + ROLLING_SIZE * 2) % ROLLING_SIZE];
    }
    return s / n;
  }

  private paintSeg(points: Point[], i: number): void {
    counters.segments++;
    const k = this.k;
    const ppw = this.ppw;
    const ox = this.box.x;
    const oy = this.box.y;
    const n = points.length;
    // world -> layer-local device px
    const P = (j: number): number[] => {
      const p = points[clamp(j, 0, n - 1)];
      return [(p[0] - ox) * ppw, (p[1] - oy) * ppw];
    };
    const a = points[i - 1];
    const b = points[i];

    // velocity in 320-space, so the curves see the same numbers they always did
    const s = REF / REF_WORLD;
    const v = calcVelocity(a[0] * s, a[1] * s, a[2], b[0] * s, b[1] * s, b[2]);
    const raw = velocityToWidth(v);
    const wB = this.pushWidth(raw);
    const slowB = 1 - (clamp(v, VMIN, VMAX) - VMIN) / (VMAX - VMIN);
    const opB = velocityToOpacity(v);
    const wA = this.wPrev == null ? wB : this.wPrev;
    const slowA = this.wPrev == null ? slowB : this.slowPrev;
    const opA = this.opPrev == null ? opB : this.opPrev;
    this.wPrev = wB;
    this.slowPrev = slowB;
    this.opPrev = opB;
    const vNorm = clamp((v - VMIN) / (VMAX - VMIN), 0, 1);

    const p0 = P(i - 2);
    const p1 = P(i - 1);
    const p2 = P(i);
    const p3 = P(i + 1);
    const chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(1, Math.ceil(chord / 1.1));
    let prev: number[] = this.lastPos ? [this.lastPos[0], this.lastPos[1]] : cr(p0, p1, p2, p3, 0);

    for (let st = 1; st <= steps; st++) {
      const u = st / steps;
      const pt = cr(p0, p1, p2, p3, u);
      const dx = pt[0] - prev[0];
      const dy = pt[1] - prev[1];
      const d = Math.hypot(dx, dy);
      if (d > 0.0001) {
        this.tan = [dx / d, dy / d];
        const d320 = d / k;
        const raw320 = wA + (wB - wA) * u;
        const slow = slowA + (slowB - slowA) * u;
        const op = opA + (opB - opA) * u;
        this.wSm =
          this.wSm == null
            ? raw320
            : this.wSm + (raw320 - this.wSm) * (1 - Math.exp(-d320 / W_SMOOTH));
        const w320 = this.wSm;
        this.advanceInk(d320, w320, slow);
        this.arc += d320;
        this.carry += d;
        const w = w320 * k * this.size;
        this.spacing = Math.max(0.8, Math.min(2.4, this.effWidth(w) * 0.08));
        while (this.carry >= this.spacing) {
          this.carry -= this.spacing;
          const back = this.carry / d;
          this.stampAt(pt[0] - dx * back, pt[1] - dy * back, w, slow, op, vNorm);
        }
      }
      prev = pt;
    }
    this.lastPos = [prev[0], prev[1]];
  }

  private advanceInk(d320: number, w320: number, slow: number): void {
    const dep = (d320 * (w320 / MAX_WIDTH) * DEP) / this.feel.inkSpan;
    this.tip = Math.max(0, this.tip - dep);
    const wander = 0.6 + 0.8 * fbm(311.9 + this.noiseShift, this.arc / 55);
    const rate = FEED * (0.3 + 0.7 * slow) * wander;
    const feed = Math.min(this.belly, d320 * rate * this.belly * (1 - this.tip));
    this.tip = Math.min(1, this.tip + feed);
    this.belly -= feed;
    this.pool += (slow * slow - this.pool) * Math.min(1, d320 * 0.11);
  }

  private lift(): number {
    if (this.totalArc === Infinity) return 0;
    const rem = this.totalArc - this.arc;
    return rem >= RELEASE ? 0 : clamp(1 - Math.max(0, rem) / RELEASE, 0, 1);
  }

  private effWidth(w: number): number {
    const settle = smoothstep(0, 1, clamp(this.arc / 15, 0, 1));
    let e = w * (0.7 + 0.3 * this.tip);
    e *= 1 + this.feel.press * settle * Math.exp(-this.arc / 16);
    e *= 1 + 0.13 * this.pool;
    e *= 0.3 + 0.7 * settle;
    e *= 1 - 0.86 * this.lift();
    return Math.max(0.45, e);
  }

  private density(op: number): number {
    let d = this.feel.flow * INK_GAIN * op;
    d *= 0.42 + 0.58 * this.tip;
    d *= 1 + 0.3 * this.pool;
    d *= 0.89 + 0.11 * fbm(517.3 + this.noiseShift, this.arc / 16);
    return clamp(d, 0, 0.97);
  }

  private landing(): number {
    return 1 + 0.35 * Math.exp(-this.arc / 13);
  }

  private dryness(vNorm: number): number {
    const base = 1.45 * (1 - this.tip) + 0.62 * vNorm - 0.44 + 0.55 * this.lift();
    return clamp(base * 2.0 * this.feel.kasure, 0, 1);
  }

  private dabAlpha(target: number, along: number): number {
    const n = Math.max(1, (along / this.spacing) * DAB_EFF);
    return 1 - Math.pow(1 - clamp(target, 0, 0.985), 1 / n);
  }

  // The tangent IS the rotation, so no atan2. One setTransform beats
  // save/translate/rotate/restore - a stroke lays down thousands of these.
  // x, y, w, len are all layer-local DEVICE px (ppw is already in them), so
  // unlike the web engine there is no dpr factor here.
  private dab(
    g: CanvasRenderingContext2D,
    sprite: HTMLCanvasElement,
    x: number, y: number, w: number, len: number, alpha: number,
  ): void {
    if (alpha <= 0.0015 || w <= 0.04) {
      counters.dabsSkipped++;
      return;
    }
    const [tx, ty] = this.tan;
    g.setTransform(tx, ty, -ty, tx, x, y);
    g.globalAlpha = alpha;
    g.drawImage(sprite, -len / 2, -w / 2, len, w);
    counters.drawImage++;
    if (DAB_SINK !== null) {
      DAB_SINK(
        g === this.bleedCtx ? LAYER_BLEED : LAYER_INK,
        sprite === this.sBody
          ? SPRITE_BODY
          : sprite === this.sHair
            ? SPRITE_HAIR
            : SPRITE_BLEED,
        x, y, tx, ty, len, w, alpha,
      );
    }
  }

  // world position of a layer-local px, in 320-space. THIS is the fix in SPEC
  // 4.3 - sampling tooth from layer-local px would anchor the paper grain to
  // the stroke's own bbox and two strokes crossing the same paper would find
  // different tooth there.
  // Written as px/k rather than (px/ppw + origin)*REF/REF_WORLD, which is the
  // same value but a different sequence of roundings. px/k is EXACTLY what the
  // web engine computes, so a stroke at the world origin samples byte-identical
  // tooth. It is also one divide instead of a divide and a multiply.
  private worldRef(px: number, py: number): [number, number] {
    const k = this.k;
    const s = REF / REF_WORLD;
    return [px / k + this.box.x * s, py / k + this.box.y * s];
  }

  private stampAt(
    x: number, y: number, w: number, slow: number, op: number, vNorm: number,
  ): void {
    counters.stamps++;
    const arc = this.arc;
    const wEff = this.effWidth(w);
    const dry = this.dryness(vNorm);
    const dens = this.density(op);
    const [tx, ty] = this.tan;
    const nx = -ty;
    const ny = tx;

    const wander = (fbm(770.3 + this.noiseShift, arc / 24) - 0.5) * wEff * 0.17 * this.feel.grain;
    const cx = x + nx * wander;
    const cy = y + ny * wander;
    const [wxr, wyr] = this.worldRef(cx, cy);
    const tooth = toothAt(wxr, wyr);

    const stretch = 1.12 + 0.55 * vNorm;

    // 1. bleed - ink creeping into the paper, under the body
    const wet = clamp(this.tip * (0.35 + 0.65 * slow) * (1 - dry) - 0.12, 0, 1);
    if (wet > 0.02) {
      const bw = wEff * (1.13 + 0.22 * wet * this.feel.bleed);
      const bl = Math.max(bw * stretch, this.spacing * 1.4);
      const bd = dens * wet * this.feel.bleed * 0.3 * (0.45 + 1.1 * tooth);
      this.dab(this.bleedCtx, this.sBleed, cx, cy, bw, bl, this.dabAlpha(bd, bl));
    }

    // 2. body - recedes as the brush dries, never all the way
    const fray = 0.97 + 0.06 * nz(88.3 + this.noiseShift, arc / 9);
    const bodyW = wEff * (1 - 0.55 * dry) * fray;
    const bodyL = Math.max(bodyW * stretch, this.spacing * 1.35);
    const bodyD = dens * this.landing() * (1 - 0.98 * dry) * (1 - 0.34 * this.feel.tooth * (1 - tooth));
    this.dab(this.inkCtx, this.sBody, cx, cy, bodyW, bodyL, this.dabAlpha(bodyD, bodyL));

    // 3. hairs - always there, just buried while the ink is wet
    const show = 0.3 + 0.7 * smoothstep(0.02, 0.55, dry);
    const buried = dry < 0.1;
    const split = smoothstep(0.05, 0.4, dry);
    const spread = 0.96 + 0.16 * dry;
    const half = wEff * 0.5;
    for (let j = 0; j < HAIR_N; j++) {
      const hair = HAIRS[j];
      if (buried && Math.abs(hair.u) < 0.7) {
        counters.hairsCulled++;
        continue;
      }
      const drift = (nz(hair.seed + 21.3 + this.noiseShift, arc / 38) - 0.5) * 0.34;
      const sway = (nz(700.7 + hair.ci * 53.1 + this.noiseShift, arc / 45) - 0.5) * 0.4;
      const uEff =
        (hair.u + (hair.clumped + sway - hair.u) * split) * spread + drift * split;
      const off = uEff * half;
      const hx = cx + nx * off;
      const hy = cy + ny * off;
      const have = hair.bias * (0.48 + 0.52 * fbm(hair.seed + this.noiseShift, arc / 52));
      const [hxr, hyr] = this.worldRef(hx, hy);
      const ht = toothAt(hxr, hyr);
      const need = 0.18 + 0.8 * dry + 0.42 * this.feel.tooth * (ht - 0.5);
      const contact = smoothstep(need - 0.18, need + 0.1, have);
      if (contact <= 0.03) {
        counters.dabsSkipped++;
        continue;
      }
      const hw = Math.max(
        0.4,
        wEff * hair.thick * (0.045 + 0.05 * nz(hair.seed + 5.5, arc / 30)) * (0.25 + 0.75 * contact),
      );
      const hl = Math.max(hw * 2.2, this.spacing * 1.6);
      const hd = dens * show * (0.82 + 0.18 * contact);
      this.dab(this.inkCtx, this.sHair, hx, hy, hw, hl, this.dabAlpha(hd, hl));
    }
  }
}

// One-shot: build a brush, paint the whole stroke, hand it back. The caller
// flattens the layers and disposes. For LIVE drawing hold an EnsoBrush and
// feed() it instead.
export function renderStroke(
  points: Point[],
  ctx: CanvasRenderingContext2D,
  box: Box,
  ppw: number,
  ink: string,
): EnsoBrush | null {
  if (!points || points.length < 3) return null;
  const brush = new EnsoBrush(ctx, box, ppw, ink);
  brush.finish(points);
  return brush;
}
