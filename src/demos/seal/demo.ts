// The hanko carver from Al's Ensō app (monostudio/enso/src/lib/carve.js): a blade, not a brush. One width, straight until
// it turns, square where it stops. Ported from Skia to canvas 2D; the steadying and the causal corner finder are unchanged.
import type { Demo, Params } from "../../lib/types";

type Pt = [number, number];

// 山 as corners, walked out into the dense, slightly unsteady points a real finger gives, so the steadying and the
// corner finder see what they would see from a hand. Normalised to the block's side.
const MOUNTAIN_CORNERS: Pt[][] = [
  [[0.5, 0.2], [0.5, 0.74]],
  [[0.24, 0.42], [0.24, 0.74], [0.76, 0.74]],
  [[0.76, 0.42], [0.76, 0.74]],
];
function walk(corners: Pt[], seed: number): Pt[] {
  let s = seed;
  const wob = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.004;
  const out: Pt[] = [];
  for (let i = 1; i < corners.length; i++) {
    const [ax, ay] = corners[i - 1], [bx, by] = corners[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 0.008));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n + wob(), ay + ((by - ay) * k) / n + wob()]);
  }
  return out;
}
const MOUNTAIN: Pt[][] = MOUNTAIN_CORNERS.map((c, i) => walk(c, 101 + i * 7));

/** The hand, steadied: each point the mean of itself and the few before it. Causal; the last point stays exact. */
function steady(points: Pt[], n: number): Pt[] {
  return points.map((_, i) => {
    const from = Math.max(0, i - n + 1);
    let x = 0, y = 0;
    for (let j = from; j <= i; j++) { x += points[j][0]; y += points[j][1]; }
    return [x / (i - from + 1), y / (i - from + 1)] as Pt;
  });
}

/** The deliberate corners. Walks forward from the last corner and fixes a new one only when the hand has drifted more than
 *  `tol` off the straight line and the run is at least `minRun` long. Nothing behind the newest corner is reconsidered. */
function trueCut(raw: Pt[], tol: number, minRun: number, n: number): Pt[] {
  if (raw.length < 3) return raw;
  const pts = steady(raw, n);
  const out: Pt[] = [pts[0]];
  let anchor = 0;
  for (let i = 2; i < pts.length; i++) {
    const [ax, ay] = pts[anchor], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    if (len < minRun) continue;
    for (let j = anchor + 1; j < i; j++) {
      const [x, y] = pts[j];
      if (Math.abs(dy * (x - ax) - dx * (y - ay)) / len > tol) {
        const c = pts[i - 1];
        if (Math.hypot(c[0] - ax, c[1] - ay) >= minRun) { anchor = i - 1; out.push(c); }
        break;
      }
    }
  }
  out.push(raw[raw.length - 1]);
  return out;
}

export const demo: Demo = {
  title: "Seal",
  description: "Carve a hanko with a blade, not a brush. Straight cuts, clean corners, stamped in vermilion.",
  origin: "From the Ensō app's hanko carver.",
  updated: "2026-11-24",
  controls: [
    { type: "toggle", key: "cut", label: "Cut (hakubun)", value: true },
    { type: "toggle", key: "border", label: "Border", value: false },
    { type: "range", key: "width", label: "Blade", min: 0.01, max: 0.16, step: 0.001, value: 0.058 },
    { type: "range", key: "tol", label: "Corner feel", min: 0.002, max: 0.1, step: 0.001, value: 0.02 },
    { type: "range", key: "minRun", label: "Shortest run", min: 0, max: 0.2, step: 0.001, value: 0.045 },
    { type: "range", key: "steady", label: "Steadying", min: 1, max: 20, step: 1, value: 5 },
    { type: "range", key: "inset", label: "Face inset", min: 0, max: 0.2, step: 0.005, value: 0.055 },
    { type: "range", key: "wear", label: "Wear", min: 0, max: 1, step: 0.01, value: 0.25 },
    { type: "range", key: "tilt", label: "Tilt", min: -20, max: 20, step: 0.5, value: -3, unit: "°" },
    { type: "colour", key: "ink", label: "Ink", value: "#c04830" },
    { type: "colour", key: "paper", label: "Paper", value: "#f4efe3" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;
    const seal = document.createElement("canvas"); // the block, drawn square and unrotated, then placed
    const sctx = seal.getContext("2d")!;
    let strokes: Pt[][] = MOUNTAIN.map((s) => s.map((q) => [...q] as Pt));
    let live: Pt[] | null = null;
    let W = 0, H = 0, dpr = 1, side = 0;
    let grain: HTMLCanvasElement | null = null;

    function makeGrain(px: number) {
      // Fixed speckle where the stamp failed to take ink: the same for every redraw, so wear never shimmers.
      const g = document.createElement("canvas");
      g.width = g.height = px;
      const x = g.getContext("2d")!, img = x.createImageData(px, px);
      let s = 12345;
      for (let i = 0; i < px * px; i++) { s = (s * 16807) % 2147483647; img.data[i * 4 + 3] = Math.floor((s / 2147483647) * 255); }
      x.putImageData(img, 0, 0);
      return g;
    }

    function resize() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      side = Math.min(W, H) * 0.6;
      const px = Math.round(side * dpr);
      seal.width = seal.height = px;
      grain = makeGrain(px);
      draw();
    }

    function paintSeal() {
      const px = seal.width, s = px;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, px, px);
      const ink = String(p.ink), cut = Boolean(p.cut);
      if (cut) {
        const inset = s * Number(p.inset);
        sctx.globalCompositeOperation = "source-over";
        sctx.fillStyle = ink;
        sctx.fillRect(inset, inset, s - inset * 2, s - inset * 2);
      }
      sctx.globalCompositeOperation = cut ? "destination-out" : "source-over";
      sctx.strokeStyle = ink;
      sctx.lineWidth = s * Number(p.width);
      sctx.lineJoin = "miter"; sctx.miterLimit = 4; sctx.lineCap = "square";
      for (const raw of live ? [...strokes, live] : strokes) {
        if (!raw.length) continue;
        const c = trueCut(raw, Number(p.tol), Number(p.minRun), Number(p.steady));
        sctx.beginPath();
        sctx.moveTo(c[0][0] * s, c[0][1] * s);
        if (c.length === 1) sctx.lineTo(c[0][0] * s + 0.01, c[0][1] * s); // a blade set down and lifted
        for (let i = 1; i < c.length; i++) sctx.lineTo(c[i][0] * s, c[i][1] * s);
        sctx.stroke();
      }
      if (p.border) {
        const w = s * 0.038;
        sctx.globalCompositeOperation = "source-over";
        sctx.lineWidth = w; sctx.lineJoin = "miter"; sctx.lineCap = "butt";
        sctx.strokeRect(w / 2, w / 2, s - w, s - w);
      }
      // Wear: knock out the speckle darker than a threshold, so more wear takes away more ink.
      const wear = Number(p.wear);
      if (wear > 0 && grain) {
        sctx.globalCompositeOperation = "destination-out";
        sctx.globalAlpha = Math.min(1, wear * 0.9);
        sctx.filter = `contrast(${1 + wear * 6})`;
        sctx.drawImage(grain, 0, 0);
        sctx.filter = "none"; sctx.globalAlpha = 1;
      }
      sctx.globalCompositeOperation = "source-over";
    }

    function draw() {
      paintSeal();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      // A seal is pressed onto a sheet, so it gets one: square to the page, the stamp tilted on it.
      // Cut strokes then print as paper whatever the theme, which is the point of hakubun.
      const ps = side * 1.28;
      ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
      ctx.fillStyle = String(p.paper);
      ctx.fillRect(-ps / 2, -ps / 2, ps, ps);
      ctx.shadowColor = "transparent";
      ctx.rotate((Number(p.tilt) * Math.PI) / 180);
      ctx.drawImage(seal, -side / 2, -side / 2, side, side);
      ctx.restore();
    }

    // Pointer to block coordinates, undoing the tilt so a cut follows the finger.
    function toBlock(e: PointerEvent): Pt {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left - W / 2, y = e.clientY - r.top - H / 2;
      const a = (-Number(p.tilt) * Math.PI) / 180;
      const rx = x * Math.cos(a) - y * Math.sin(a), ry = x * Math.sin(a) + y * Math.cos(a);
      return [rx / side + 0.5, ry / side + 0.5];
    }
    const down = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); live = [toBlock(e)]; draw(); };
    const move = (e: PointerEvent) => { if (!live) return; live.push(toBlock(e)); draw(); };
    const up = () => { if (live && live.length >= 3) strokes.push(live); live = null; draw(); };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    return {
      update(next) { p = next; draw(); },
      reset() { strokes = []; live = null; draw(); }, // a fresh block to carve
      destroy() { ro.disconnect(); canvas.remove(); },
    };
  },
};
