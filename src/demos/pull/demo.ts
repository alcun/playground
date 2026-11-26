// The hanging avatar from alcun.dev (DraggableAvatar): pull it like a light switch cord, let go and it springs home,
// tap it and it flips. react-spring's tension/friction/mass are the same equation, integrated here by hand.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const SVGNS = "http://www.w3.org/2000/svg";

export const demo: Demo = {
  title: "Pull",
  origin: "From alcun.dev: the old hanging avatar.",
  description: "A face on a cord. Pull it and let go; tap it and it flips.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "tension", label: "Tension", min: 2, max: 400, step: 1, value: 25 },
    { type: "range", key: "friction", label: "Friction", min: 0.5, max: 60, step: 0.5, value: 6 },
    { type: "range", key: "mass", label: "Mass", min: 0.2, max: 10, step: 0.1, value: 1 },
    { type: "range", key: "reach", label: "Max pull", min: 20, max: 600, step: 5, value: 200, unit: "px" },
    { type: "range", key: "cord", label: "Cord", min: 0, max: 0.8, step: 0.01, value: 0.35 },
    { type: "range", key: "size", label: "Size", min: 40, max: 300, step: 1, value: 120, unit: "px" },
    { type: "range", key: "tilt", label: "Swing tilt", min: 0, max: 1, step: 0.01, value: 0.5 },
    { type: "range", key: "flip", label: "Flip spring", min: 10, max: 300, step: 1, value: 80 },
    { type: "toggle", key: "bob", label: "Bob on load", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" });
    const line = document.createElementNS(SVGNS, "line");
    Object.assign(line.style, { stroke: "var(--ink-soft)", strokeWidth: "2", strokeLinecap: "round" });
    svg.append(line);
    const face = document.createElement("button");
    face.type = "button";
    face.setAttribute("aria-label", "Pull me, or tap to flip");
    face.innerHTML = `<svg viewBox="-50 -50 100 100" width="100%" height="100%" aria-hidden="true">
      <circle r="47" fill="var(--paper)" stroke="var(--ink)" stroke-width="4"/>
      <circle cx="-16" cy="-8" r="6" fill="var(--ink)"/><circle cx="16" cy="-8" r="6" fill="var(--ink)"/>
      <path d="M-20 14 Q0 32 20 14" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-30" cy="10" r="7" fill="var(--glint)" opacity=".35"/><circle cx="30" cy="10" r="7" fill="var(--glint)" opacity=".35"/></svg>`;
    Object.assign(face.style, { position: "absolute", left: "0", top: "0", padding: "0", border: "0", background: "none", borderRadius: "50%", cursor: "grab", touchAction: "none", willChange: "transform" });
    stage.append(svg, face);

    let W = 0, H = 0, raf = 0, last = 0;
    let x = 0, y = 0, vx = 0, vy = 0; // offset from rest
    let rot = { X: 0, Y: 0, Z: 0 }, rotV = { X: 0, Y: 0, Z: 0 }, rotTo = { X: 0, Y: 0, Z: 0 };
    let drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;

    const rest = () => ({ x: W / 2, y: Math.max(Number(p.size) / 2 + 8, H * Number(p.cord) + Number(p.size) / 2) });
    function layout() {
      const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
      face.style.width = face.style.height = `${Number(p.size)}px`;
      paint();
    }
    function paint() {
      const s = Number(p.size), r = rest();
      const cx = r.x + x, cy = r.y + y;
      line.setAttribute("x1", String(W / 2)); line.setAttribute("y1", "0");
      line.setAttribute("x2", String(cx)); line.setAttribute("y2", String(cy - s / 2));
      const swing = (Math.atan2(x, Math.max(1, r.y + y)) * 180) / Math.PI * Number(p.tilt);
      face.style.transform = `translate(${cx - s / 2}px, ${cy - s / 2}px) perspective(600px) rotateX(${rot.X}deg) rotateY(${rot.Y}deg) rotateZ(${rot.Z - swing}deg)`;
    }

    function step(dt: number) {
      const k = Number(p.tension), c = Number(p.friction), m = Number(p.mass);
      if (!drag) {
        vx += ((-k * x - c * vx) / m) * dt; vy += ((-k * y - c * vy) / m) * dt;
        x += vx * dt; y += vy * dt;
      }
      const fk = Number(p.flip), fc = 2 * Math.sqrt(fk) * 0.75; // flips settle with a little overshoot
      for (const a of ["X", "Y", "Z"] as const) { rotV[a] += (fk * (rotTo[a] - rot[a]) - fc * rotV[a]) * dt; rot[a] += rotV[a] * dt; }
    }
    const settled = () => !drag && Math.hypot(x, y) < 0.05 && Math.hypot(vx, vy) < 0.05 && (["X", "Y", "Z"] as const).every((a) => Math.abs(rotTo[a] - rot[a]) < 0.05 && Math.abs(rotV[a]) < 0.05);
    function frame(now: number) {
      let dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      // Substeps keep stiff springs stable at high tension.
      const n = Math.ceil(dt / 0.004); dt /= n;
      for (let i = 0; i < n; i++) step(dt);
      paint();
      if (settled()) { x = y = vx = vy = 0; paint(); raf = 0; return; }
      raf = requestAnimationFrame(frame);
    }
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    face.addEventListener("pointerdown", (e) => {
      try { face.setPointerCapture(e.pointerId); } catch {} face.style.cursor = "grabbing";
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y, moved: false };
      vx = vy = 0; wake();
    });
    face.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      let mx = drag.ox + e.clientX - drag.sx, my = drag.oy + e.clientY - drag.sy;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
      const d = Math.hypot(mx, my), max = Number(p.reach);
      if (d > max) { mx = (mx / d) * max; my = (my / d) * max; }
      x = mx; y = my; paint();
    });
    const release = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const tap = !drag.moved;
      drag = null; face.style.cursor = "grab";
      if (tap && !reducedMotion()) { const a = (["X", "Y", "Z"] as const)[Math.floor(Math.random() * 3)]; rotTo[a] += 360; }
      if (reducedMotion()) { x = y = 0; paint(); return; }
      wake();
    };
    face.addEventListener("pointerup", release);
    face.addEventListener("pointercancel", release);

    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    layout();
    let bobTimer = 0;
    // A small drop on arrival, the hint that it can be pulled.
    if (p.bob && !reducedMotion()) bobTimer = window.setTimeout(() => { vy = 140; wake(); }, 500);

    return {
      update(next) { p = next; layout(); wake(); },
      reset() { x = y = vx = vy = 0; rot = { X: 0, Y: 0, Z: 0 }; rotV = { X: 0, Y: 0, Z: 0 }; rotTo = { X: 0, Y: 0, Z: 0 }; paint(); },
      destroy() { clearTimeout(bobTimer); cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); face.remove(); },
    };
  },
};
