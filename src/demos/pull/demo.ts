// The hanging avatar from alcun.dev (DraggableAvatar): pull it like a light switch cord, let go and it springs home,
// tap it and it flips. react-spring's tension/friction/mass are the same equation, integrated here by hand.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const SVGNS = "http://www.w3.org/2000/svg";

export const demo: Demo = {
  title: "Pull",
  origin: "From alcun.dev: the old hanging avatar.",
  description: "An avatar on a cord. Pull it and let go, tap it to flip, or hang your own picture on it.",
  updated: "2026-11-26",
  controls: [
    { type: "range", key: "tension", label: "Tension", min: 2, max: 400, step: 1, value: 25 },
    { type: "range", key: "friction", label: "Friction", min: 0.5, max: 60, step: 0.5, value: 6 },
    { type: "range", key: "mass", label: "Mass", min: 0.2, max: 10, step: 0.1, value: 5 },
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
    // A plain avatar until the visitor picks their own picture. The picture never leaves their browser:
    // it is shrunk to 256px and kept in this browser's storage, nowhere else.
    const KEY = "playground:pull:picture";
    const clip = `pull-clip-${Math.random().toString(36).slice(2)}`;
    const avatar = `<svg viewBox="-50 -50 100 100" width="100%" height="100%" aria-hidden="true">
      <clipPath id="${clip}"><circle r="45"/></clipPath>
      <circle r="47" fill="var(--paper)"/>
      <g clip-path="url(#${clip})" fill="var(--ink-faint)"><circle cy="-10" r="17"/><ellipse cy="42" rx="33" ry="26"/></g>
      <circle r="47" fill="none" stroke="var(--ink)" stroke-width="4"/></svg>`;
    const showFace = (url: string | null) => {
      if (!url) { face.innerHTML = avatar; return; }
      const img = document.createElement("img");
      img.src = url; img.alt = ""; img.draggable = false;
      Object.assign(img.style, { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", boxSizing: "border-box", border: "4px solid var(--ink)", pointerEvents: "none", display: "block" });
      face.replaceChildren(img);
    };
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    showFace(saved);
    Object.assign(face.style, { position: "absolute", left: "0", top: "0", padding: "0", border: "0", background: "none", borderRadius: "50%", cursor: "grab", touchAction: "none", willChange: "transform" });
    stage.append(svg, face);

    // Only on the toy's own page (the index tiles take no input): a button to use your own picture.
    const own = stage.id === "stage";
    const bar = document.createElement("div");
    if (own) {
      Object.assign(bar.style, { position: "absolute", left: "50%", bottom: "16px", transform: "translateX(-50%)", display: "flex", gap: "8px" });
      const pill = "display:inline-flex;align-items:center;height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--hair);background:var(--paper);color:var(--ink);font:500 14px/1 inherit;cursor:pointer";
      const pick = document.createElement("label");
      pick.style.cssText = pill;
      pick.textContent = "Your picture";
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*"; input.hidden = true;
      pick.append(input);
      const clear = document.createElement("button");
      clear.type = "button"; clear.style.cssText = pill; clear.textContent = "Remove";
      const sync = (url: string | null) => { showFace(url); clear.style.display = url ? "" : "none"; };
      sync(saved);
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const raw = URL.createObjectURL(file), im = new Image();
        im.onload = () => {
          // Centre-crop to a 256px square so it fits storage and the circle.
          const c = document.createElement("canvas"); c.width = c.height = 256;
          const side = Math.min(im.naturalWidth, im.naturalHeight);
          c.getContext("2d")!.drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
          URL.revokeObjectURL(raw);
          const url = c.toDataURL("image/jpeg", 0.85);
          try { localStorage.setItem(KEY, url); } catch {}
          sync(url);
        };
        im.src = raw;
        input.value = "";
      });
      clear.addEventListener("click", () => { try { localStorage.removeItem(KEY); } catch {} sync(null); });
      bar.append(pick, clear);
      stage.append(bar);
    }

    let W = 0, H = 0, raf = 0, last = 0;
    let x = 0, y = 0, vx = 0, vy = 0; // offset from rest
    let rot = { X: 0, Y: 0, Z: 0 }, rotV = { X: 0, Y: 0, Z: 0 }, rotTo = { X: 0, Y: 0, Z: 0 };
    let drag: { id: number; sx: number; sy: number; ox: number; oy: number; tx: number; ty: number; moved: boolean } | null = null;

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
      // Let go: the heavy spring home. Held: a stiff, light spring chasing the pointer (alcun.dev's 600/35).
      const k = drag ? 600 : Number(p.tension), c = drag ? 35 : Number(p.friction), m = drag ? 1 : Number(p.mass);
      const tx = drag ? drag.tx : 0, ty = drag ? drag.ty : 0;
      vx += ((-k * (x - tx) - c * vx) / m) * dt; vy += ((-k * (y - ty) - c * vy) / m) * dt;
      x += vx * dt; y += vy * dt;
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
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: x, oy: y, tx: x, ty: y, moved: false };
      wake();
    });
    face.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      let mx = drag.ox + e.clientX - drag.sx, my = drag.oy + e.clientY - drag.sy;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
      const d = Math.hypot(mx, my), max = Number(p.reach);
      if (d > max) { mx = (mx / d) * max; my = (my / d) * max; }
      drag.tx = mx; drag.ty = my;
      if (reducedMotion()) { x = mx; y = my; paint(); } else wake();
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
      destroy() { clearTimeout(bobTimer); cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); face.remove(); bar.remove(); },
    };
  },
};
