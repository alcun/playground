import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";
import { EnsoBrush, type Point } from "./brush";
import { feelFor } from "./feel";

const WORLD = 1200; // the paper is WORLD x WORLD world units
const PACE = 13; // world units per ms of brush time at speed 1

type Stroke = { pts: Point[]; size: number | null }; // size null = follow the slider

/** An enso: one loop of the brush, slow to land, quick round, slowing to lift. */
function enso(speed: number, gap: number): Point[] {
  const pts: Point[] = [];
  const cx = WORLD / 2, cy = WORLD / 2, r = WORLD * 0.33;
  const start = -Math.PI * 0.62, sweep = Math.PI * 2 * (1 - gap);
  const n = 220;
  let t = 0, px = 0, py = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = start + sweep * u;
    // A hand is not a compass: the radius breathes a little round the loop.
    const rr = r * (1 + 0.035 * Math.sin(u * 5.1 + 0.7) + 0.02 * Math.sin(u * 13.3));
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i > 0) {
      const pace = PACE * speed * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7);
      t += Math.hypot(x - px, y - py) / Math.max(0.5, pace);
    }
    pts.push([x, y, t]);
    px = x; py = y;
  }
  return pts;
}

export const demo: Demo = {
  title: "Ink brush",
  description: "A sumi brush with kasure, bleed and paper tooth. Paint on the paper; every stroke repaints as you move a slider.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "wetness", label: "Wetness", min: 0, max: 1, step: 0.01, value: 0.5 },
    { type: "range", key: "dryness", label: "Dry brush", min: 0, max: 1, step: 0.01, value: 0.55 },
    { type: "range", key: "tooth", label: "Tooth", min: 0, max: 1, step: 0.01, value: 0.5 },
    { type: "range", key: "grain", label: "Jitter", min: 0, max: 1, step: 0.01, value: 0.25 },
    { type: "range", key: "seed", label: "Seed", min: 0, max: 50, step: 1, value: 3 },
    { type: "range", key: "size", label: "Size", min: 0.1, max: 3, step: 0.05, value: 1.1 },
    { type: "range", key: "speed", label: "Enso speed", min: 0.1, max: 4, step: 0.05, value: 1 },
    { type: "range", key: "gap", label: "Enso gap", min: 0, max: 0.4, step: 0.01, value: 0.07 },
    { type: "colour", key: "ink", label: "Ink", value: "#181511" },
    { type: "colour", key: "paper", label: "Paper", value: "#f2e9da" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const pad = document.createElement("div");
    Object.assign(pad.style, {
      position: "absolute", inset: "0", margin: "auto", aspectRatio: "1",
      width: "min(92%, 92cqh)", maxHeight: "92%", borderRadius: "6px",
      boxShadow: "0 1px 0 color-mix(in srgb, var(--ink) 10%, transparent), 0 10px 30px -12px color-mix(in srgb, var(--ink) 35%, transparent)",
      touchAction: "none",
    });
    stage.style.containerType = "size";
    const base = document.createElement("canvas");
    const live = document.createElement("canvas");
    for (const c of [base, live]) Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%", borderRadius: "inherit" });
    pad.append(base, live);
    stage.append(pad);

    let ppw = 0, brush: EnsoBrush | null = null, raf = 0, repaintQueued = 0;
    let mine: Point[] | null = null, t0 = 0;
    // Stroke 0 is the enso, regenerated from its sliders; the rest are yours.
    let yours: Stroke[] = [];
    const ensoStroke = (): Stroke => ({ pts: enso(Number(p.speed), Number(p.gap)), size: null });

    const feel = () => feelFor({ wetness: Number(p.wetness), dryness: Number(p.dryness), tooth: Number(p.tooth), grain: Number(p.grain), seed: Number(p.seed) });
    const wipe = (c: HTMLCanvasElement) => c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    const keep = () => { base.getContext("2d")!.drawImage(live, 0, 0); wipe(live); };
    const brushFor = (size: number) => {
      brush?.dispose();
      brush = new EnsoBrush(live.getContext("2d")!, { x: 0, y: 0, w: WORLD, h: WORLD }, ppw, String(p.ink), size, feel());
      return brush;
    };
    const settle = (s: Stroke) => { brushFor(s.size ?? Number(p.size)).finish(s.pts); keep(); };

    function repaintAll() {
      repaintQueued = 0;
      if (!ppw) return;
      pad.style.background = String(p.paper);
      wipe(base);
      settle(ensoStroke());
      for (const s of yours) settle(s);
    }
    // Sliders fire on every pixel of travel; repaint at most once a frame.
    const queueRepaint = () => { if (!repaintQueued) repaintQueued = requestAnimationFrame(repaintAll); };

    function setup() {
      const css = pad.clientWidth;
      if (!css) return;
      const px = Math.round(css * Math.min(devicePixelRatio || 1, 2));
      ppw = px / WORLD;
      if (px === base.width) return;
      for (const c of [base, live]) { c.width = px; c.height = px; }
      repaintAll();
    }

    // Brush the enso on at a pace you can watch, once, on arrival.
    function paintIn() {
      if (reducedMotion() || !ppw) return repaintAll();
      pad.style.background = String(p.paper);
      const s = ensoStroke();
      const b = brushFor(Number(p.size));
      const end = s.pts[s.pts.length - 1][2];
      const begun = performance.now();
      const step = () => {
        const shown = ((performance.now() - begun) / 1400) * end; // about 1.4s to watch, whatever the brush time
        if (shown >= end) { b.finish(s.pts); keep(); return; }
        let n = 2;
        while (n < s.pts.length && s.pts[n][2] <= shown) n++;
        b.feed(s.pts.slice(0, n));
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    const point = (e: PointerEvent): Point => {
      const r = live.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * WORLD, ((e.clientY - r.top) / r.height) * WORLD, performance.now() - t0];
    };
    const down = (e: PointerEvent) => {
      if (!ppw) return;
      e.preventDefault();
      cancelAnimationFrame(raf);
      live.setPointerCapture(e.pointerId);
      t0 = performance.now();
      mine = [point(e)];
      brushFor(Number(p.size));
    };
    const move = (e: PointerEvent) => {
      if (!mine || !brush) return;
      for (const c of e.getCoalescedEvents?.() ?? [e]) {
        const q = point(c), last = mine[mine.length - 1];
        if (Math.abs(q[0] - last[0]) > 1e-3 || Math.abs(q[1] - last[1]) > 1e-3) mine.push(q);
      }
      brush.feed(mine);
    };
    const up = () => {
      if (!mine || !brush) return;
      const pts = mine;
      mine = null;
      if (pts.length < 3) { wipe(live); return; }
      brush.finish(pts); // once more, whole, so it gets its release taper
      keep();
      yours.push({ pts, size: null });
    };
    live.addEventListener("pointerdown", down);
    live.addEventListener("pointermove", move);
    live.addEventListener("pointerup", up);
    live.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(setup);
    ro.observe(pad);
    setup();
    wipe(base);
    paintIn();

    return {
      update(next) { p = next; queueRepaint(); },
      reset() { yours = []; cancelAnimationFrame(raf); wipe(base); paintIn(); },
      destroy() {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(repaintQueued);
        ro.disconnect();
        brush?.dispose();
        pad.remove();
      },
    };
  },
};
