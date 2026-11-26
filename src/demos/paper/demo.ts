// A sheet of paper from clack, the browser typewriter: 3D Verlet points with bending links, texture-mapped and lit.
// The simulation and renderer are clack's, vendored in ./cloth.ts; this file only adds the knobs and a page to hold.
import type { Demo, Params } from "../../lib/types";
import * as cloth from "./cloth";

const W = 1036, H = 1462; // clack's sheet, in sheet units
const LINES = [
  "Our revels now are ended. These our actors,",
  "As I foretold you, were all spirits and",
  "Are melted into air, into thin air:",
  "And, like the baseless fabric of this vision,",
  "The cloud-capp'd towers, the gorgeous palaces,",
  "The solemn temples, the great globe itself,",
  "Yea, all which it inherit, shall dissolve",
  "And, like this insubstantial pageant faded,",
  "Leave not a rack behind. We are such stuff",
  "As dreams are made on, and our little life",
  "Is rounded with a sleep.",
];

function sheet(paper: string, ink: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const k = 0.6; // texture scale; uv mapping scales to whatever size this is
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const g = c.getContext("2d")!;
  g.scale(k, k);
  g.fillStyle = paper; g.fillRect(0, 0, W, H);
  g.fillStyle = ink;
  g.font = "22px ui-monospace, 'Courier New', monospace";
  LINES.forEach((t, i) => g.fillText(t, 140, 8 * 34 + i * 34 * 1.5));
  g.globalAlpha = 0.5;
  g.fillText("The Tempest, IV.i", 140, 8 * 34 + (LINES.length + 1) * 34 * 1.5);
  return c;
}

export const demo: Demo = {
  title: "Paper",
  description: "A sheet of paper that bends like paper. Grab it anywhere, fling it, let it settle.",
  origin: "From clack, the browser typewriter: its sheet of paper.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "gravity", label: "Gravity", min: 0, max: 0.6, step: 0.005, value: 0.115 },
    { type: "range", key: "damping", label: "Air", min: 0.8, max: 0.999, step: 0.001, value: 0.965 },
    { type: "range", key: "restore", label: "Memory", min: 0, max: 0.2, step: 0.001, value: 0.022 },
    { type: "range", key: "iterations", label: "Stiffness", min: 1, max: 40, step: 1, value: 12 },
    { type: "range", key: "cols", label: "Mesh across", min: 3, max: 20, step: 1, value: 9 },
    { type: "range", key: "rows", label: "Mesh down", min: 3, max: 28, step: 1, value: 13 },
    { type: "range", key: "depth", label: "Perspective", min: 500, max: 6000, step: 50, value: 1700 },
    { type: "range", key: "size", label: "Size", min: 0.2, max: 1, step: 0.01, value: 0.72 },
    { type: "toggle", key: "pin", label: "Pin the top", value: false },
    { type: "toggle", key: "shadow", label: "Shadow", value: true },
    { type: "colour", key: "paper", label: "Paper", value: "#f4efe3" },
    { type: "colour", key: "ink", label: "Type", value: "#2a2622" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
    stage.append(canvas);
    const g = canvas.getContext("2d")!;
    let SW = 0, SH = 0, dpr = 1, raf = 0, dirty = true;
    let c = cloth.makeCloth(W, H, Number(p.cols), Number(p.rows));
    let tex = sheet(String(p.paper), String(p.ink));
    const view: cloth.View = { cx: 0, cy: 0, scale: 1, depth: Number(p.depth) };

    function build(kick: boolean) {
      c = cloth.makeCloth(W, H, Number(p.cols), Number(p.rows));
      cloth.restFree(c);
      if (p.pin) for (let i = 0; i < c.cols; i++) c.pin[i] = 1;
      cloth.settle(c);
      if (kick) cloth.kick(c, 1.6, 1.1);
      dirty = true; wake();
    }
    function fit() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      SW = r.width; SH = r.height;
      canvas.width = Math.round(SW * dpr); canvas.height = Math.round(SH * dpr);
      view.cx = SW / 2; view.cy = SH / 2;
      view.scale = Math.min(SW / W, SH / H) * Number(p.size);
      view.depth = Number(p.depth);
      dirty = true; wake();
    }
    const tuning = (): cloth.ClothTuning => ({ gravity: Number(p.gravity), damping: Number(p.damping), restore: Number(p.restore), iterations: Number(p.iterations) });

    function frame(ts: number) {
      raf = 0;
      if (c.held >= 0 || cloth.energy(c) > 0.0012) { cloth.step(c, tuning(), ts); dirty = true; }
      if (dirty) {
        dirty = false;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, SW, SH);
        cloth.render(g, c, tex, view, { width: SW, height: SH, shadow: Boolean(p.shadow) });
        raf = requestAnimationFrame(frame);
      }
    }
    const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

    const local = (e: PointerEvent): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener("pointerdown", (e) => {
      const [x, y] = local(e);
      if (!cloth.contains(c, x, y, view)) return;
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      canvas.style.cursor = "grabbing";
      cloth.grab(c, cloth.pick(c, x, y, view), x, y, view);
      dirty = true; wake();
    });
    canvas.addEventListener("pointermove", (e) => { if (c.held < 0) return; const [x, y] = local(e); cloth.moveGrab(c, x, y, view); dirty = true; wake(); });
    const up = () => { cloth.release(c); canvas.style.cursor = "grab"; wake(); };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    fit();
    build(true);

    return {
      update(next) {
        const mesh = next.cols !== p.cols || next.rows !== p.rows || next.pin !== p.pin;
        const look = next.paper !== p.paper || next.ink !== p.ink;
        p = next;
        if (look) tex = sheet(String(p.paper), String(p.ink));
        if (mesh) build(false);
        fit();
      },
      reset() { build(true); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); },
    };
  },
};
