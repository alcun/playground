import type { Demo, Params } from "../../lib/types";
import { onThemeChange, reducedMotion, tokens } from "../../lib/theme";

// Four summed waves. The second-harmonic term sharpens crests and leaves long,
// rounded troughs: sin(a) - crest * cos(2a).
const WAVES = [
  { x: 0.038, z: 0.075, amplitude: 2.9, speed: 0.93, phase: 0 },
  { x: -0.105, z: 0.068, amplitude: 1.35, speed: 1.25, phase: 1.8 },
  { x: 0.17, z: 0.19, amplitude: 0.42, speed: 1.72, phase: 0.5 },
  { x: -0.36, z: 0.26, amplitude: 0.16, speed: 2.3, phase: 2.4 },
];
const NEAR = 6, FAR = 420;

export const demo: Demo = {
  title: "Sea",
  description: "A rolling sea from four summed waves, seen from a boat's height.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "swell", label: "Swell", min: 0, max: 3, step: 0.05, value: 1 },
    { type: "range", key: "cross", label: "Cross swell", min: 0, max: 3, step: 0.05, value: 1 },
    { type: "range", key: "chop", label: "Chop", min: 0, max: 6, step: 0.05, value: 1 },
    { type: "range", key: "crest", label: "Crest", min: -0.5, max: 0.5, step: 0.01, value: 0.24 },
    { type: "range", key: "rough", label: "Open water", min: 0, max: 1.5, step: 0.01, value: 0.45 },
    { type: "range", key: "length", label: "Wavelength", min: 0.25, max: 4, step: 0.05, value: 1 },
    { type: "range", key: "wind", label: "Wind", min: -180, max: 180, step: 1, value: 0, unit: "°" },
    { type: "range", key: "speed", label: "Speed", min: 0, max: 4, step: 0.05, value: 1 },
    { type: "range", key: "camera", label: "Camera", min: 2, max: 60, step: 0.5, value: 12 },
    { type: "range", key: "rows", label: "Rows", min: 10, max: 120, step: 1, value: 56 },
    { type: "range", key: "cols", label: "Columns", min: 10, max: 160, step: 1, value: 72 },
    { type: "toggle", key: "lines", label: "Lines", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;
    let width = 0, height = 0, frame = 0, clock = 0, last = 0;
    let colour = tokens(["ink", "ink-faint", "glint"]);

    function height_(x: number, z: number, t: number) {
      const len = 1 / Number(p.length), crest = Number(p.crest);
      const a = (Number(p.wind) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const gains = [Number(p.swell), Number(p.cross), Number(p.chop), Number(p.chop)];
      let h = 0;
      for (let i = 0; i < WAVES.length; i++) {
        const w = WAVES[i];
        // Rotate each wave's direction by the wind, scale its frequency by wavelength.
        const kx = (w.x * c - w.z * s) * len, kz = (w.x * s + w.z * c) * len;
        const ph = x * kx + z * kz - t * w.speed + w.phase;
        h += gains[i] * w.amplitude * (Math.sin(ph) - crest * Math.cos(2 * ph));
      }
      return h * Number(p.rough);
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = r.width; height = r.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const rows = Number(p.rows), cols = Number(p.cols), cam = Number(p.camera);
      const f = Math.min(width, height * 1.6) * 0.9;
      const horizon = height * 0.3;
      const lines = Boolean(p.lines);
      const dot = Math.max(1.5, Math.min(width, height) / 260);
      // Shade against the tallest wave these settings can make, so calm water still reads.
      const gains = [Number(p.swell), Number(p.cross), Number(p.chop), Number(p.chop)];
      const peak = Math.max(0.2, WAVES.reduce((a, w, i) => a + gains[i] * w.amplitude, 0) * Number(p.rough));
      // Rows evenly spaced on screen: linear in 1/z, far to near so near rows paint on top.
      for (let r = 0; r < rows; r++) {
        const v = r / (rows - 1);
        const z = 1 / (1 / FAR + (1 / NEAR - 1 / FAR) * v);
        const near = v; // 0 at the horizon, 1 at the camera
        const spread = (width / f) * z * 0.6;
        if (lines) ctx.beginPath();
        for (let ci = 0; ci < cols; ci++) {
          const x = (ci / (cols - 1) - 0.5) * 2 * spread;
          const y = height_(x, z, clock);
          const sx = width / 2 + (x * f) / z;
          const sy = horizon + ((cam - y) * f) / z;
          // Crests catch the light, troughs fall back, distance fades it all.
          const lift = Math.max(0, Math.min(1, 0.5 + y / (1.4 * peak)));
          ctx.globalAlpha = (0.3 + 0.7 * near) * (0.45 + 0.55 * lift);
          if (lines) {
            ci === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
          } else {
            ctx.fillStyle = lift > 0.8 ? colour.glint : lift > 0.45 ? colour.ink : colour["ink-faint"];
            const size = dot * (0.5 + 1.5 * near);
            ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
          }
        }
        if (lines) {
          ctx.globalAlpha = 0.15 + 0.7 * near;
          ctx.strokeStyle = colour.ink;
          ctx.lineWidth = 0.6 + 1.2 * near;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function tick(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clock += dt * Number(p.speed);
      draw();
      frame = requestAnimationFrame(tick);
    }
    function start() {
      cancelAnimationFrame(frame);
      last = 0;
      if (reducedMotion() || Number(p.speed) === 0) draw();
      else frame = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const offTheme = onThemeChange(() => { colour = tokens(["ink", "ink-faint", "glint"]); draw(); });
    start();

    return {
      update(next) { p = next; start(); },
      reset() { clock = 0; draw(); },
      destroy() { cancelAnimationFrame(frame); ro.disconnect(); offTheme(); canvas.remove(); },
    };
  },
};
