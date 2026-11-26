import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

// The tilting name badge from Eponymous (alcun/eponymous, HeroBadge.astro), rewritten
// without Atropos: a spring-eased tilt toward the pointer, with each layer shifted by
// its own depth so the card reads as a stack, and the spiral of polygons generated here.

const SVGNS = "http://www.w3.org/2000/svg";

export const demo: Demo = {
  title: "Name badge",
  origin: "From Eponymous, the Astro template.",
  description: "The Eponymous name badge. It tilts toward your pointer in layers.",
  updated: "2026-11-25",
  controls: [
    { type: "text", key: "top", label: "Top line", value: "Hello! My name is" },
    { type: "text", key: "name", label: "Name", value: "Eponymous.dev" },
    { type: "text", key: "bottom", label: "Bottom line", value: "An Astro template for posts and projects" },
    { type: "range", key: "tilt", label: "Tilt", min: 0, max: 45, step: 0.5, value: 14, unit: "°" },
    { type: "range", key: "depth", label: "Depth", min: 0, max: 3, step: 0.05, value: 1 },
    { type: "range", key: "ease", label: "Ease", min: 0.02, max: 0.5, step: 0.01, value: 0.1 },
    { type: "range", key: "sides", label: "Sides", min: 3, max: 12, step: 1, value: 5 },
    { type: "range", key: "rings", label: "Rings", min: 1, max: 40, step: 1, value: 16 },
    { type: "range", key: "twist", label: "Twist", min: -45, max: 45, step: 0.5, value: 10, unit: "°" },
    { type: "range", key: "line", label: "Line", min: 1, max: 40, step: 0.5, value: 10.8 },
    { type: "toggle", key: "shine", label: "Shine", value: true },
    { type: "toggle", key: "idle", label: "Idle sway", value: true },
    { type: "colour", key: "card", label: "Card", value: "#000000" },
    { type: "colour", key: "glow", label: "Spiral", value: "#1ae7ff" },
    { type: "colour", key: "tag", label: "Tag", value: "#3b3b3b" },
    { type: "colour", key: "ink", label: "Name", value: "#4fd1c5" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const still = reducedMotion();

    const style = document.createElement("style");
    style.textContent = `
      .bd { position: absolute; inset: 0; display: grid; place-items: center; perspective: 1500px; touch-action: none; user-select: none; -webkit-user-select: none; }
      .bd-card { position: relative; width: min(86%, 620px); aspect-ratio: 8 / 5; border-radius: 20px; overflow: hidden;
        transform-style: preserve-3d; box-shadow: 0 20px 50px rgba(0, 0, 0, .55); container-type: inline-size; }
      .bd-card > * { position: absolute; will-change: transform; }
      .bd-bg { inset: -12%; }
      .bd-bg svg { width: 100%; height: 100%; display: block; }
      .bd-text { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 6cqw; gap: 3cqw; }
      .bd-top, .bd-bottom { color: #fff; margin: 0; text-shadow: 2px 2px 8px rgba(0,0,0,.4); font-weight: 600; line-height: 1.2; }
      .bd-top { font-size: 4.6cqw; }
      .bd-bottom { font-size: 3.6cqw; font-weight: 500; }
      .bd-name { margin: 0; padding: 2.6cqw 5.5cqw; border-radius: 10px; font-size: 7.6cqw; font-weight: 700; line-height: 1.1;
        box-shadow: 0 10px 24px -8px rgba(0,0,0,.6); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
      .bd-shine { inset: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity .3s ease; }`;

    const wrap = document.createElement("div");
    wrap.className = "bd";
    const card = document.createElement("div");
    card.className = "bd-card";
    const bg = document.createElement("div");
    bg.className = "bd-bg";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "-1000 -750 2000 1500");
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    bg.append(svg);
    const top = document.createElement("p");
    top.className = "bd-top";
    const name = document.createElement("p");
    name.className = "bd-name";
    const bottom = document.createElement("p");
    bottom.className = "bd-bottom";
    const text = document.createElement("div");
    text.className = "bd-text";
    text.append(top, name, bottom);
    const shine = document.createElement("div");
    shine.className = "bd-shine";
    card.append(bg, text, shine);
    wrap.append(card);
    stage.append(style, wrap);

    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    function spiral() {
      // Nested polygons, each one larger and turned a little further, fading from the card colour to the spiral colour.
      const sides = Number(p.sides), rings = Number(p.rings), twist = Number(p.twist);
      const a = hex(String(p.card)), b = hex(String(p.glow));
      const pts = Array.from({ length: sides }, (_, k) => {
        const t = (k / sides) * Math.PI * 2 - Math.PI / 2;
        return `${(510 * Math.cos(t)).toFixed(1)},${(510 * Math.sin(t)).toFixed(1)}`;
      }).join(" ");
      let out = "";
      for (let i = 1; i <= rings; i++) {
        const f = rings === 1 ? 1 : (i - 1) / (rings - 1);
        const c = a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",");
        out += `<polygon points="${pts}" fill="none" stroke="rgb(${c})" stroke-width="${Number(p.line)}" transform="rotate(${(twist * i - 160).toFixed(2)}) scale(${(1 + i * 0.1) * 0.874})" />`;
      }
      svg.innerHTML = out;
    }
    function apply() {
      card.style.background = String(p.card);
      name.style.background = String(p.tag);
      name.style.color = String(p.ink);
      top.textContent = String(p.top);
      name.textContent = String(p.name);
      bottom.textContent = String(p.bottom);
      top.hidden = !String(p.top);
      bottom.hidden = !String(p.bottom);
      shine.style.opacity = p.shine ? "1" : "0";
      spiral();
    }

    // tilt in -1..1 on each axis: current, target and whether a pointer is driving it
    let x = 0, y = 0, tx = 0, ty = 0, held = false, raf = 0, t0 = performance.now();
    function paint() {
      const max = Number(p.tilt), d = Number(p.depth);
      card.style.transform = `rotateX(${(-y * max).toFixed(3)}deg) rotateY(${(x * max).toFixed(3)}deg)`;
      // Layers slide against the tilt by their depth, the way Atropos offsets work: the back
      // drifts with you, the text toward you, so the card reads as a stack rather than a sheet.
      bg.style.transform = `translate(${(-x * 4 * d).toFixed(2)}%, ${(-y * 4 * d).toFixed(2)}%)`;
      text.style.transform = `translate(${(x * 2.2 * d).toFixed(2)}%, ${(y * 2.2 * d).toFixed(2)}%) translateZ(${(40 * d).toFixed(1)}px)`;
      const gx = 50 + x * 50, gy = 50 + y * 50;
      shine.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,${(0.08 + 0.16 * Math.hypot(x, y)).toFixed(3)}), transparent 60%)`;
    }
    function tick(now: number) {
      if (!held && p.idle && !still) {
        // a slow figure of eight, so the badge is never quite still on the wall
        const s = (now - t0) / 1000;
        tx = Math.sin(s * 0.7) * 0.45;
        ty = Math.sin(s * 1.1) * 0.3;
      }
      const k = Number(p.ease);
      x += (tx - x) * k;
      y += (ty - y) * k;
      paint();
      const moving = Math.abs(tx - x) + Math.abs(ty - y) > 0.0005;
      raf = moving || held || (p.idle && !still) ? requestAnimationFrame(tick) : 0;
    }
    function wake() { if (!raf) raf = requestAnimationFrame(tick); }

    function aim(e: PointerEvent) {
      const r = card.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      held = true;
      if (still) { x = tx; y = ty; paint(); } else wake();
    }
    const leave = () => {
      held = false;
      tx = 0; ty = 0;
      t0 = performance.now(); // idle starts again from the centre, where the release leaves it
      if (still) { x = 0; y = 0; paint(); } else wake();
    };
    const down = (e: PointerEvent) => { wrap.setPointerCapture(e.pointerId); aim(e); };
    const move = (e: PointerEvent) => { if (e.pointerType === "mouse" || wrap.hasPointerCapture(e.pointerId)) aim(e); };
    const up = (e: PointerEvent) => { if (e.pointerType !== "mouse") leave(); };
    wrap.addEventListener("pointerdown", down);
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", leave);
    wrap.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") leave(); });

    apply();
    paint();
    wake();

    return {
      update(next) {
        p = next;
        apply();
        if (still) paint(); else wake();
      },
      destroy() {
        cancelAnimationFrame(raf);
        wrap.remove();
        style.remove();
      },
    };
  },
};
