// Grown from the googly eyes that used to sit on alcun.dev (two eyes, pupils snapped to the pointer): now a crowd, with lag, blinking and an idle wander.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

type Eye = { el: HTMLDivElement; pupil: HTMLDivElement; lid: HTMLDivElement; cx: number; cy: number; px: number; py: number; vx: number; vy: number; nextBlink: number; blinkT: number };

export const demo: Demo = {
  title: "Eyes",
  origin: "From alcun.dev: the old googly eyes.",
  description: "A crowd of eyes that follow your pointer, blink, and look around when you leave.",
  updated: "2026-11-24",
  tile: 640,
  controls: [
    { type: "range", key: "count", label: "Eyes", min: 1, max: 60, step: 1, value: 12 },
    { type: "range", key: "size", label: "Size", min: 16, max: 200, step: 1, value: 64, unit: "px" },
    { type: "range", key: "pupil", label: "Pupil", min: 0.1, max: 0.9, step: 0.01, value: 0.42 },
    { type: "range", key: "reach", label: "Reach", min: 0, max: 1, step: 0.01, value: 0.75 },
    { type: "range", key: "lag", label: "Lag", min: 0, max: 0.98, step: 0.01, value: 0.82 },
    { type: "range", key: "wobble", label: "Wobble", min: 0, max: 1, step: 0.01, value: 0.35 },
    { type: "range", key: "blink", label: "Blinks a minute", min: 0, max: 60, step: 1, value: 12 },
    { type: "range", key: "jitter", label: "Scatter", min: 0, max: 1, step: 0.01, value: 0.35 },
    { type: "toggle", key: "pair", label: "In pairs", value: true },
    { type: "colour", key: "white", label: "Whites", value: "#fffdf7" },
    { type: "colour", key: "iris", label: "Pupils", value: "#141414" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const root = document.createElement("div");
    Object.assign(root.style, { position: "absolute", inset: "0", overflow: "hidden" });
    stage.append(root);
    let eyes: Eye[] = [];
    let target: { x: number; y: number } | null = null;
    let wander = { x: 0, y: 0, t: 0 };
    let raf = 0, last = 0, time = 0;

    function build() {
      root.replaceChildren(); eyes = [];
      const W = stage.clientWidth, H = stage.clientHeight; // layout size: the index tile scales the stage down with a transform
      const n = Number(p.count), s = Number(p.size), pair = Boolean(p.pair);
      const units = pair ? Math.ceil(n / 2) : n;
      const cols = Math.max(1, Math.round(Math.sqrt((units * W) / Math.max(1, H) / (pair ? 2 : 1))));
      const rows = Math.ceil(units / cols);
      let seed = 9;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      // Scatter each face (a pair, or a lone eye), never the eyes within a pair.
      const j = Number(p.jitter);
      const faces = Array.from({ length: units }, (_, u) => ({
        x: (W * ((u % cols) + 0.5)) / cols + (r() - 0.5) * j * (W / cols) * 0.6,
        y: (H * (Math.floor(u / cols) + 0.5)) / rows + (r() - 0.5) * j * (H / rows) * 0.6,
      }));
      for (let i = 0; i < n; i++) {
        const { x: ux, y: uy } = faces[pair ? Math.floor(i / 2) : i];
        const cx = pair ? ux + (i % 2 ? 0.58 : -0.58) * s : ux;
        const el = document.createElement("div");
        Object.assign(el.style, { position: "absolute", left: `${cx - s / 2}px`, top: `${uy - s / 2}px`, width: `${s}px`, height: `${s}px`, borderRadius: "50%", background: String(p.white), border: `${Math.max(1.5, s * 0.04)}px solid var(--ink)`, overflow: "hidden", boxSizing: "border-box" });
        const pupil = document.createElement("div");
        const ps = s * Number(p.pupil);
        Object.assign(pupil.style, { position: "absolute", left: "50%", top: "50%", width: `${ps}px`, height: `${ps}px`, margin: `${-ps / 2}px 0 0 ${-ps / 2}px`, borderRadius: "50%", background: String(p.iris) });
        const glint = document.createElement("div");
        Object.assign(glint.style, { position: "absolute", left: "22%", top: "20%", width: "26%", height: "26%", borderRadius: "50%", background: String(p.white), opacity: "0.85" });
        pupil.append(glint);
        const lid = document.createElement("div");
        Object.assign(lid.style, { position: "absolute", inset: "0", background: String(p.iris), transformOrigin: "50% 0", transform: "scaleY(0)" });
        el.append(pupil, lid);
        root.append(el);
        eyes.push({ el, pupil, lid, cx, cy: uy, px: 0, py: 0, vx: 0, vy: 0, nextBlink: r() * 6, blinkT: -1 });
      }
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; time += dt;
      const s = Number(p.size), reach = (s / 2) * (1 - Number(p.pupil)) * Number(p.reach) * 0.95;
      // Nobody pointing: pick somewhere to look every couple of seconds.
      if (!target) {
        wander.t -= dt;
        if (wander.t <= 0) { wander = { x: Math.random() * stage.clientWidth, y: Math.random() * stage.clientHeight, t: 1.2 + Math.random() * 2.5 }; }
      }
      const look = target ?? wander;
      const lag = Number(p.lag), k = (1 - lag) * 60, damp = 2 * Math.sqrt(k) * (1 - Number(p.wobble) * 0.85);
      const bpm = Number(p.blink);
      eyes.forEach((e, i) => {
        const dx = look.x - e.cx, dy = look.y - e.cy, d = Math.hypot(dx, dy) || 1;
        const m = Math.min(reach, d * 0.25); // close targets pull less: eyes converge instead of slamming to the rim
        const tx = (dx / d) * m, ty = (dy / d) * m;
        if (lag === 0) { e.px = tx; e.py = ty; }
        else { e.vx += (k * (tx - e.px) - damp * e.vx) * dt * 10; e.vy += (k * (ty - e.py) - damp * e.vy) * dt * 10; e.px += e.vx * dt; e.py += e.vy * dt; }
        e.pupil.style.transform = `translate(${e.px}px, ${e.py}px)`;
        const twin = p.pair && i % 2 === 1 ? eyes[i - 1] : null; // a pair blinks together, or it reads as a wink
        if (twin) { e.lid.style.transform = twin.lid.style.transform; return; }
        if (bpm > 0) {
          e.nextBlink -= dt;
          if (e.nextBlink <= 0 && e.blinkT < 0) { e.blinkT = 0; e.nextBlink = (60 / bpm) * (0.5 + Math.random()); }
        }
        if (e.blinkT >= 0) {
          e.blinkT += dt / 0.16;
          e.lid.style.transform = `scaleY(${e.blinkT < 1 ? e.blinkT : Math.max(0, 2 - e.blinkT)})`;
          if (e.blinkT >= 2) { e.blinkT = -1; e.lid.style.transform = "scaleY(0)"; }
        }
      });
      raf = requestAnimationFrame(frame);
    }

    const toLocal = (ev: PointerEvent) => { const b = stage.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
    const move = (ev: PointerEvent) => { target = toLocal(ev); };
    const leave = () => { target = null; wander.t = 0.4; };
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerdown", move);
    stage.addEventListener("pointerleave", leave);

    const ro = new ResizeObserver(build);
    ro.observe(stage);
    build();
    // Reduced motion: eyes still follow the pointer (that is the interaction) but no wander, no blink, no spring.
    const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    if (reducedMotion()) { p = { ...p, lag: 0, blink: 0 }; }
    start();

    return {
      update(next) {
        const rebuild = ["count", "size", "pupil", "jitter", "pair", "white", "iris"].some((k) => next[k] !== p[k]);
        p = reducedMotion() ? { ...next, lag: 0, blink: 0 } : next;
        if (rebuild) build();
      },
      destroy() {
        cancelAnimationFrame(raf); ro.disconnect();
        stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerdown", move); stage.removeEventListener("pointerleave", leave);
        root.remove();
      },
    };
  },
};
