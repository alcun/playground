// Grass after the Shangri-La Gardening footer (Al's own generator: mulberry32 + one blade path), redrawn on canvas so it can be mown.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const BLADE_D = "M0 0C.6-9 1.6-18 5-25 4.4-17 3.2-9 2.4 0Z"; // base at origin, 25 units tall; a Path2D is made in mount, never at module top
type Blade = { x: number; layer: number; sy: number; sx: number; rest: number; phase: number; g: number };
type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; life: number };

function rand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const demo: Demo = {
  title: "Lawn",
  description: "Grass in a breeze. Drag across it to mow a stripe and watch it grow back.",
  origin: "From the Shangri-La Gardening site footer.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "height", label: "Height", min: 20, max: 400, step: 1, value: 200, unit: "px" },
    { type: "range", key: "density", label: "Density", min: 2, max: 60, step: 1, value: 22 },
    { type: "range", key: "width", label: "Blade width", min: 0.3, max: 5, step: 0.1, value: 1 },
    { type: "range", key: "variety", label: "Variety", min: 0, max: 1, step: 0.01, value: 0.6 },
    { type: "range", key: "lean", label: "Lean", min: 0, max: 45, step: 1, value: 12, unit: "°" },
    { type: "range", key: "layers", label: "Layers", min: 1, max: 6, step: 1, value: 4 },
    { type: "range", key: "wind", label: "Wind", min: 0, max: 30, step: 0.5, value: 5, unit: "°" },
    { type: "range", key: "gust", label: "Gust speed", min: 0, max: 4, step: 0.05, value: 0.7 },
    { type: "range", key: "mower", label: "Mower", min: 10, max: 240, step: 1, value: 60, unit: "px" },
    { type: "range", key: "cut", label: "Cut to", min: 0, max: 0.8, step: 0.01, value: 0.12 },
    { type: "range", key: "regrow", label: "Regrow", min: 0.5, max: 60, step: 0.5, value: 8, unit: "s" },
    { type: "range", key: "seed", label: "Seed", min: 1, max: 999, step: 1, value: 106 },
    { type: "toggle", key: "auto", label: "Auto mow", value: false },
    { type: "toggle", key: "clippings", label: "Clippings", value: true },
    { type: "colour", key: "front", label: "Front", value: "#6f9a3c" },
    { type: "colour", key: "back", label: "Back", value: "#3e6b2f" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;
    const BLADE = new Path2D(BLADE_D);

    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0, sweep = -1;
    let blades: Blade[] = [];
    let bits: Bit[] = [];
    let mowing = false, lastX: number | null = null;

    function build() {
      const r = rand(Number(p.seed));
      const L = Number(p.layers), per = Number(p.density) / 100, v = Number(p.variety);
      blades = [];
      for (let layer = 0; layer < L; layer++) {
        let x = -20 + r() * 10;
        while (x < W + 20) {
          blades.push({
            x, layer,
            sy: 1 - v * 0.6 + r() * v * 0.9,
            sx: (r() < 0.5 ? -1 : 1) * (0.8 + r() * 0.55),
            rest: (r() * 2 - 1),
            phase: r() * Math.PI * 2,
            g: 1,
          });
          x += (0.5 + r()) / per;
        }
      }
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      build();
      draw();
    }

    function cutAt(x0: number, x1: number) {
      const half = Number(p.mower) / 2, lo = Math.min(x0, x1) - half, hi = Math.max(x0, x1) + half, to = Number(p.cut);
      for (const b of blades) {
        if (b.x < lo || b.x > hi || b.g <= to + 0.02) continue;
        if (p.clippings && bits.length < 400 && Math.random() < 0.5) {
          const h = Number(p.height) * b.sy * b.g;
          bits.push({ x: b.x, y: H - h * 0.6, vx: (Math.random() - 0.3) * 160, vy: -120 - Math.random() * 220, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, life: 1 });
        }
        b.g = to;
      }
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const L = Number(p.layers), hPx = Number(p.height), still = reducedMotion();
      const wind = still ? 0 : Number(p.wind) * (Math.PI / 180), lean = Number(p.lean) * (Math.PI / 180), gust = Number(p.gust);
      const unit = hPx / 25, wid = Number(p.width);
      for (let layer = 0; layer < L; layer++) {
        const depth = L === 1 ? 1 : layer / (L - 1); // 0 back, 1 front
        ctx.fillStyle = mix(String(p.back), String(p.front), depth);
        const base = H - (1 - depth) * hPx * 0.18;
        for (const b of blades) {
          if (b.layer !== layer) continue;
          const sway = wind * (Math.sin(time * gust * 2 + b.x * 0.012 + b.phase * 0.3) * 0.7 + Math.sin(time * gust * 3.3 + b.phase) * 0.3);
          ctx.save();
          ctx.translate(b.x, base);
          ctx.rotate(b.rest * lean + sway);
          ctx.scale(b.sx * wid * unit * 0.32, unit * b.sy * b.g * (0.75 + depth * 0.25));
          ctx.fill(BLADE);
          ctx.restore();
        }
      }
      ctx.fillStyle = String(p.front);
      for (const c of bits) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, c.life);
        ctx.translate(c.x, c.y); ctx.rotate(c.r);
        ctx.fillRect(-3, -1, 6, 2);
        ctx.restore();
      }
    }

    function busy() {
      const moving = !reducedMotion() && Number(p.wind) > 0 && Number(p.gust) > 0;
      return moving || p.auto || bits.length > 0 || blades.some((b) => b.g < 1);
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; time += dt;
      const grow = dt / Number(p.regrow);
      for (const b of blades) if (b.g < 1) b.g = Math.min(1, b.g + grow);
      if (p.auto) {
        const prev = sweep;
        sweep += dt * Math.max(W / 3, 120);
        if (sweep > W + Number(p.mower) + W * 0.6) sweep = -Number(p.mower);
        cutAt(prev, sweep);
      }
      for (const c of bits) { c.vy += 700 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.life -= dt * 0.8; }
      bits = bits.filter((c) => c.life > 0 && c.y < H + 10);
      draw();
      raf = busy() ? requestAnimationFrame(frame) : 0;
    }
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const local = (e: PointerEvent) => e.clientX - canvas.getBoundingClientRect().left;
    const down = (e: PointerEvent) => { mowing = true; canvas.setPointerCapture(e.pointerId); lastX = local(e); cutAt(lastX, lastX); wake(); };
    const move = (e: PointerEvent) => { if (!mowing) return; const x = local(e); cutAt(lastX ?? x, x); lastX = x; wake(); };
    const up = () => { mowing = false; lastX = null; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();
    wake();

    return {
      update(next) {
        const rebuild = ["density", "variety", "layers", "seed"].some((k) => next[k] !== p[k]);
        p = next;
        if (rebuild) build();
        draw(); wake();
      },
      reset() { for (const b of blades) b.g = 1; bits = []; sweep = -1; draw(); wake(); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); },
    };
  },
};

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
