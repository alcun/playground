// From alcun.dev's party mode (the Konami code drops 100 squares from the top). Here it bursts from wherever you tap,
// and each piece is a card turning over in the air: its height follows the cosine of its spin, which is what reads as flutter.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const COLORS = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9", "#fd79a8", "#a29bfe"]; // alcun.dev's party palette
type Bit = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; flip: number; vf: number; w: number; h: number; c: string; life: number };

export const demo: Demo = {
  title: "Confetti",
  description: "Tap anywhere for a burst. Every piece turns over as it falls.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "count", label: "Pieces", min: 5, max: 600, step: 5, value: 120 },
    { type: "range", key: "power", label: "Power", min: 100, max: 3000, step: 10, value: 1600 },
    { type: "range", key: "spread", label: "Spread", min: 5, max: 360, step: 1, value: 70, unit: "°" },
    { type: "range", key: "gravity", label: "Gravity", min: 0, max: 3000, step: 10, value: 900 },
    { type: "range", key: "drag", label: "Air", min: 0, max: 6, step: 0.05, value: 1.4 },
    { type: "range", key: "flutter", label: "Flutter", min: 0, max: 30, step: 0.5, value: 12 },
    { type: "range", key: "size", label: "Size", min: 2, max: 30, step: 0.5, value: 9, unit: "px" },
    { type: "range", key: "sway", label: "Sway", min: 0, max: 400, step: 5, value: 90 },
    { type: "range", key: "every", label: "Auto pop", min: 0, max: 10, step: 0.5, value: 3, unit: "s" },
    { type: "toggle", key: "rain", label: "Rain from the top", value: false },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "manipulation", cursor: "pointer" });
    stage.append(canvas);
    const g = canvas.getContext("2d")!;
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0, time = 0, nextPop = 0.4;
    let bits: Bit[] = [];

    function burst(x: number, y: number) {
      const n = Number(p.count), power = Number(p.power), spread = (Number(p.spread) * Math.PI) / 180, s = Number(p.size);
      const rain = Boolean(p.rain);
      for (let i = 0; i < n && bits.length < 3000; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * spread, v = power * (0.35 + Math.random() * 0.65);
        bits.push({
          x: rain ? Math.random() * W : x, y: rain ? -20 - Math.random() * H * 0.3 : y,
          vx: rain ? (Math.random() - 0.5) * 60 : Math.cos(a) * v, vy: rain ? Math.random() * 120 : Math.sin(a) * v,
          rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 8, flip: Math.random() * 6.3, vf: (0.5 + Math.random()) * Number(p.flutter),
          w: s * (0.7 + Math.random() * 0.6), h: s * (0.4 + Math.random() * 0.3), c: COLORS[(Math.random() * COLORS.length) | 0], life: 1,
        });
      }
      wake();
    }

    function step(dt: number) {
      const grav = Number(p.gravity), drag = Number(p.drag), sway = Number(p.sway);
      for (const b of bits) {
        // A card falling face-on catches more air than one edge-on: drag follows how open it is.
        const open = 0.35 + 0.65 * Math.abs(Math.cos(b.flip));
        b.vx += (-b.vx * drag * open + Math.sin(time * 2 + b.rot) * sway * open) * dt;
        b.vy += (grav - b.vy * drag * open) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.rot += b.vr * dt; b.flip += b.vf * dt;
        if (b.y > H + 30) b.life = 0;
      }
      bits = bits.filter((b) => b.life > 0);
    }
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      for (const b of bits) {
        const c = Math.cos(b.flip);
        g.save();
        g.translate(b.x, b.y); g.rotate(b.rot); g.scale(1, c);
        g.fillStyle = b.c;
        g.globalAlpha = c < 0 ? 0.75 : 1; // the back of the paper is a touch duller
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        g.restore();
      }
    }
    function frame(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0);
      last = now; time += dt;
      const every = Number(p.every);
      if (every > 0 && !reducedMotion()) { nextPop -= dt; if (nextPop <= 0) { nextPop = every; burst(W * (0.25 + Math.random() * 0.5), H * 0.85); } }
      step(dt); draw();
      raf = bits.length || (every > 0 && !reducedMotion()) ? requestAnimationFrame(frame) : 0;
    }
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    canvas.addEventListener("pointerdown", (e) => { const r = canvas.getBoundingClientRect(); burst(e.clientX - r.left, e.clientY - r.top); });

    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      draw();
    });
    ro.observe(stage);
    wake();
    return {
      update(next) { p = next; nextPop = Math.min(nextPop, Number(p.every) || nextPop); wake(); },
      reset() { bits = []; nextPop = 0.4; draw(); wake(); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); },
    };
  },
};
