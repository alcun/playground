import type { Demo, Params } from "../../lib/types";

const SVGNS = "http://www.w3.org/2000/svg";
type Point = { x: number; y: number; ox: number; oy: number; fixed: boolean };

const STOP = 0.4; // total movement below which the loop sleeps
const GRAB_RADIUS = 26; // px from a point to pick it up

export const demo: Demo = {
  title: "Rope",
  description: "A Verlet rope. Grab any point and swing it; drop an end and it stays put.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "segment", label: "Segment", min: 8, max: 80, step: 1, value: 34, unit: "px" },
    { type: "range", key: "gravity", label: "Gravity", min: 0, max: 3000, step: 10, value: 900 },
    { type: "range", key: "damping", label: "Damping", min: 0.9, max: 1, step: 0.001, value: 0.99 },
    { type: "range", key: "iterations", label: "Stiffness", min: 1, max: 200, step: 1, value: 120 },
    { type: "range", key: "slack", label: "Slack", min: -5, max: 40, step: 0.5, value: -2, unit: "%" },
    { type: "range", key: "thickness", label: "Thickness", min: 1, max: 12, step: 0.2, value: 3.4, unit: "px" },
    { type: "toggle", key: "weightless", label: "Weightless", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible", fill: "none", touchAction: "none" });
    const path = (cls: string) => {
      const el = document.createElementNS(SVGNS, "path");
      el.setAttribute("class", cls);
      return el;
    };
    const hit = path("hit");
    const parts = { shadow: path("shadow"), body: path("body"), twist: path("twist"), twist2: path("twist"), hi: path("hi") };
    svg.append(hit, ...Object.values(parts));
    stage.append(svg);

    const style = document.createElement("style");
    style.textContent = `
      .stage .hit { stroke: transparent; pointer-events: stroke; cursor: grab; stroke-linecap: round; -webkit-touch-callout: none; user-select: none; }
      .stage.grabbing .hit { cursor: grabbing; }
      .stage .shadow { stroke: color-mix(in srgb, var(--ink) 22%, transparent); stroke-linecap: round; }
      .stage .body { stroke: var(--rope); stroke-linecap: round; }
      .stage .twist { stroke: color-mix(in srgb, var(--ink) 30%, transparent); stroke-linecap: butt; }
      .stage .hi { stroke: color-mix(in srgb, var(--paper) 55%, transparent); stroke-linecap: round; }`;
    stage.append(style);

    let P: Point[] = [];
    let N = 0, D = 0, raf = 0, running = false, prevDt = 0, last = 0;
    let active = false; // gravity applies once the rope has been touched (or always, if not weightless)
    let grab = -1, wasEnd = false;
    let drop: [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];

    function applyStyle() {
      const t = Number(p.thickness);
      const coarse = matchMedia("(pointer: coarse)").matches;
      // The visible rope can be thin; only its invisible finger target grows.
      hit.style.strokeWidth = String(Math.max(t * 2, coarse ? 52 : 24));
      parts.shadow.style.strokeWidth = String(t * 1.5);
      parts.body.style.strokeWidth = String(t);
      for (const tw of [parts.twist, parts.twist2]) {
        tw.style.strokeWidth = String(t * 0.47);
        tw.style.strokeDasharray = `${t * 0.38} ${t * 1.35}`;
      }
      parts.twist2.style.strokeDashoffset = String(t * 0.87);
      parts.hi.style.strokeWidth = String(t * 0.26);
    }

    function anchors() {
      const r = svg.getBoundingClientRect();
      const pad = Math.max(24, r.width * 0.08);
      const y = r.height * 0.42;
      return [{ x: pad, y }, { x: r.width - pad, y }];
    }
    const home = (i: number) => drop[i === 0 ? 0 : 1] ?? anchors()[i === 0 ? 0 : 1];
    function local(e: PointerEvent) {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function build() {
      const a = anchors();
      const span = Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y);
      N = Math.max(4, Math.round(span / Number(p.segment)) + 1);
      D = (span / (N - 1)) * (1 + Number(p.slack) / 100);
      P = [];
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const x = a[0].x + (a[1].x - a[0].x) * t, y = a[0].y + (a[1].y - a[0].y) * t;
        P.push({ x, y, ox: x, oy: y, fixed: i === 0 || i === N - 1 });
      }
      // Settle into its hang now, rather than animating a droop on load.
      prevDt = 0;
      for (let s = 0; s < 400; s++) {
        pin();
        update(1 / 60);
        if (s > 20 && motion() < STOP) break;
      }
      prevDt = 0;
      draw();
    }

    function pin() {
      const h0 = home(0), h1 = home(N - 1);
      if (grab !== 0) Object.assign(P[0], { x: h0.x, y: h0.y, ox: h0.x, oy: h0.y });
      if (grab !== N - 1) Object.assign(P[N - 1], { x: h1.x, y: h1.y, ox: h1.x, oy: h1.y });
    }

    function update(dt: number) {
      const g = active ? Number(p.gravity) : 0;
      // Stormer-Verlet with a time correction. The dt ratio is CLAMPED: one short
      // frame followed by a long one (tab switch, GC pause) otherwise multiplies
      // every velocity and the rope leaves the page.
      const tc = prevDt !== 0 ? Math.min(1.5, dt / prevDt) : 0;
      const vc = tc * Number(p.damping), ac = dt * dt;
      for (let i = 1; i < N - 1; i++) {
        const q = P[i];
        if (q.fixed) continue;
        const vx = q.x - q.ox, vy = q.y - q.oy;
        q.ox = q.x; q.oy = q.y;
        q.x += vx * vc;
        q.y += vy * vc + g * ac;
      }
      // A near-inextensible chain needs many passes; at 4 it visibly stretches.
      const iters = Number(p.iterations);
      for (let k = 0; k < iters; k++) {
        for (let j = 0; j < N - 1; j++) {
          const a = P[j], b = P[j + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1e-9;
          const diff = len - D, nx = dx / len, ny = dy / len;
          if (!a.fixed) { a.x += nx * diff * 0.25; a.y += ny * diff * 0.25; }
          if (!b.fixed) { b.x -= nx * diff * 0.25; b.y -= ny * diff * 0.25; }
        }
      }
      prevDt = dt;
    }

    function motion() {
      let m = 0;
      for (let i = 1; i < N - 1; i++) m += Math.abs(P[i].x - P[i].ox) + Math.abs(P[i].y - P[i].oy);
      return m;
    }

    function draw() {
      // Catmull-Rom as cubic beziers, so the curve passes THROUGH every point and
      // grabbing what you see picks up the point that is actually there.
      let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
      for (let i = 0; i < N - 1; i++) {
        const p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2 < N ? i + 2 : N - 1];
        d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}`
          + ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)}`
          + ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      hit.setAttribute("d", d);
      for (const el of Object.values(parts)) el.setAttribute("d", d);
    }

    function tick(now: number) {
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
      last = now;
      pin();
      update(dt);
      const r = svg.getBoundingClientRect();
      if (P.some((q) => !isFinite(q.x) || !isFinite(q.y) || Math.abs(q.y) > r.height * 6 || Math.abs(q.x) > r.width * 6)) {
        // Gone unstable anyway (extreme slider values can do it): rebuild rather than chase it.
        drop = [null, null]; grab = -1; build(); running = false; last = 0;
        return;
      }
      draw();
      if (grab < 0 && motion() < STOP) { running = false; last = 0; return; }
      raf = requestAnimationFrame(tick);
    }
    function wake() {
      if (!running) { running = true; last = 0; raf = requestAnimationFrame(tick); }
    }

    function release(e?: PointerEvent) {
      if (grab < 0) return;
      try { if (e && hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId); } catch {}
      if (wasEnd) {
        // An end stays where you drop it, but never further from the other end
        // than the rope reaches: held wider it is dragged dead straight and looks broken.
        const other = P[grab === 0 ? N - 1 : 0];
        const reach = (N - 1) * D * 0.97;
        const dx = P[grab].x - other.x, dy = P[grab].y - other.y, dist = Math.hypot(dx, dy);
        if (dist > reach) { P[grab].x = other.x + (dx / dist) * reach; P[grab].y = other.y + (dy / dist) * reach; }
        drop[grab === 0 ? 0 : 1] = { x: P[grab].x, y: P[grab].y };
      } else {
        P[grab].fixed = false; // a middle point is let go of, not put down, so it falls
      }
      grab = -1;
      stage.classList.remove("grabbing");
      wake();
    }

    const onDown = (e: PointerEvent) => {
      const l = local(e);
      let near = -1, best = Math.max(GRAB_RADIUS, Number(p.segment));
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(l.x - P[i].x, l.y - P[i].y);
        if (d < best) { best = d; near = i; }
      }
      if (near < 0) return;
      e.preventDefault();
      grab = near;
      wasEnd = near === 0 || near === N - 1;
      P[grab].fixed = true;
      active = true;
      hit.setPointerCapture(e.pointerId);
      stage.classList.add("grabbing");
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (grab < 0) return;
      e.preventDefault();
      // A hovering mouse with no button means a pointer-up escaped us. Not for
      // touch: fingers may report buttons=0 mid-drag.
      if (e.pointerType === "mouse" && e.buttons === 0) return release(e);
      const q = P[grab], l = local(e);
      q.ox = q.x; q.oy = q.y; q.x = l.x; q.y = l.y;
      wake();
    };
    // iOS can start a native scroll despite touch-action on an SVG stroke.
    const holdTouch = (e: TouchEvent) => { if (grab >= 0) e.preventDefault(); };
    const onWindowUp = (e: PointerEvent) => release(e);
    const onBlur = () => release();

    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", release);
    hit.addEventListener("pointercancel", release);
    hit.addEventListener("lostpointercapture", release);
    hit.addEventListener("touchmove", holdTouch, { passive: false });
    addEventListener("pointerup", onWindowUp);
    addEventListener("pointercancel", onWindowUp);
    addEventListener("blur", onBlur);

    let size = "";
    const ro = new ResizeObserver(() => {
      const r = svg.getBoundingClientRect();
      const next = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (next === size) return;
      size = next;
      drop = [null, null];
      build();
    });

    function reset() {
      drop = [null, null];
      grab = -1;
      active = !p.weightless;
      build();
      wake();
    }

    active = !p.weightless;
    applyStyle();
    ro.observe(svg);

    return {
      update(next) {
        const rebuild = next.segment !== p.segment || next.slack !== p.slack;
        if (next.weightless !== p.weightless) active = !next.weightless;
        p = next;
        applyStyle();
        if (rebuild) build();
        wake();
      },
      reset,
      destroy() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        removeEventListener("pointerup", onWindowUp);
        removeEventListener("pointercancel", onWindowUp);
        removeEventListener("blur", onBlur);
        svg.remove();
        style.remove();
      },
    };
  },
};
