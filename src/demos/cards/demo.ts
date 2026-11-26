import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

// alcun.dev's "things I've made" rigging (components/MadeHere), without React and
// without the CSS-animation handoff: here the physics simply runs while the toy is
// on screen, so the breeze, the coupled pendulums and the rope chain are one loop.

const icons = import.meta.glob<string>("./icons/*.svg", { eager: true, query: "?url", import: "default" });
const icon = (n: string) => icons[`./icons/${n}.svg`];
const CARDS = [
  ["Heyra", "voice to text", "heyra"],
  ["Signalboarder", "live trains", "signal"],
  ["Glossaray", "speech translator", "glossaray"],
  ["Sumicat", "shared ink canvas", "sumicat"],
  ["Fork", "browser tuner", "fork"],
  ["monostudio", "small apps", "monostudio"],
  ["LoggerLizard", "events + analytics", "loggerlizard"],
  ["siteLookerAtter", "website screenshots", "sitelookeratter"],
  ["VitalsBeacon", "web performance", "vitalsbeacon"],
  ["AgentBeacon", "AI legibility audits", "agentbeacon"],
  ["the sea", "sail the lighthouse", "sea"],
  ["the moon", "walk the planetoid", "moon"],
  ["ensō", "leave a circle", "enso"],
];

const SVGNS = "http://www.w3.org/2000/svg";
const RUN_PAST = 30; // px of rope past the rig, so it leaves the frame at both ends
const STEP = 1000 / 60; // the constants are per 60Hz frame, as on alcun.dev

// Shape is keyed to POSITION, not to the card, as on the homepage.
const hangerFor = (i: number, base: number) => base + (i % 3) * 7;
const droopAt = (i: number, span: number, sag: number) => {
  const t = (i % span) / span;
  return 4 * sag * t * (1 - t);
};
// The idle breeze: one sine per card with its own period and offset, so the row never moves as a block.
const breezeAt = (i: number, s: number, amp: number) =>
  -amp * (0.7 + (i % 3) * 0.15) * Math.cos((2 * Math.PI * (s + i * 1.37)) / (9 + (i % 4) * 1.3));

export const demo: Demo = {
  title: "Hanging cards",
  description: "The cards on a rope from alcun.dev. Brush them, scroll them or lift the rope.",
  updated: "2026-11-26",
  controls: [
    { type: "range", key: "count", label: "Cards", min: 1, max: CARDS.length, step: 1, value: CARDS.length },
    { type: "range", key: "breeze", label: "Breeze", min: 0, max: 10, step: 0.1, value: 2.4, unit: "°" },
    { type: "range", key: "coupling", label: "Coupling", min: 0, max: 0.03, step: 0.0002, value: 0.0038 },
    { type: "range", key: "damping", label: "Damping", min: 0.95, max: 0.999, step: 0.0005, value: 0.9855 },
    { type: "range", key: "pull", label: "Scroll pull", min: 0, max: 0.04, step: 0.001, value: 0.01 },
    { type: "range", key: "maxAngle", label: "Max swing", min: 5, max: 60, step: 1, value: 22, unit: "°" },
    { type: "range", key: "hanger", label: "Hanger", min: 6, max: 60, step: 1, value: 18, unit: "px" },
    { type: "range", key: "sag", label: "Swag", min: 0, max: 260, step: 1, value: 30, unit: "px" },
    { type: "range", key: "lift", label: "Rope lift", min: 0, max: 80, step: 1, value: 26, unit: "px" },
    { type: "range", key: "ropeK", label: "Rope spring", min: 0.005, max: 0.15, step: 0.001, value: 0.03 },
    { type: "range", key: "ropeDamp", label: "Rope damping", min: 0.5, max: 0.98, step: 0.01, value: 0.83 },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    // Arrays hold every card; n is how many are showing. Loops run to n, so hidden cards cost nothing.
    const N = CARDS.length;
    let n = Number(p.count) || N;
    const still = reducedMotion();

    const style = document.createElement("style");
    style.textContent = `
      .hc { position: absolute; inset: 0; display: flex; align-items: center; overflow-x: auto; overflow-y: hidden;
        overscroll-behavior-x: contain; scrollbar-width: none; cursor: grab; user-select: none; -webkit-user-select: none;
        --card: color-mix(in srgb, var(--paper) 30%, #fff); }
      .dark .hc { --card: color-mix(in srgb, var(--paper) 91%, var(--ink)); }
      .hc::-webkit-scrollbar { display: none; }
      .hc.dragging { cursor: grabbing; }
      .hc-rig { position: relative; flex: 0 0 auto; box-sizing: border-box; min-width: 100%; padding: 40px 3rem 2rem; }
      .hc-wide .hc-rig { padding-inline: 8rem; }
      .hc svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; fill: none; z-index: 2; }
      .hc .grab { stroke: transparent; stroke-width: 24; pointer-events: stroke; cursor: grab; touch-action: none; -webkit-touch-callout: none; }
      @media (pointer: coarse) { .hc .grab { stroke-width: 44; } }
      .hc.held .grab { cursor: grabbing; }
      .hc .shadow { stroke: color-mix(in srgb, var(--ink) 25%, transparent); stroke-width: 5; stroke-linecap: round; }
      .hc .body { stroke: var(--rope); stroke-width: 3.5; stroke-linecap: round; }
      .hc .twist { stroke: color-mix(in srgb, var(--ink) 30%, transparent); stroke-width: 1.7; stroke-dasharray: 1.3 4.6; }
      .hc .hi { stroke: color-mix(in srgb, var(--paper) 60%, transparent); stroke-width: .9; stroke-linecap: round; }
      .hc ul { position: relative; display: flex; align-items: flex-start; justify-content: center; gap: 10px; list-style: none; margin: 0; padding: 0; }
      .hc li { display: flex; flex-direction: column; align-items: center; }
      .hc-knot { position: relative; z-index: 1; width: 7px; height: 7px; border-radius: 50%; background: var(--rope);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 35%, transparent); }
      .hc-swing { display: flex; flex-direction: column; align-items: center; transform-origin: top center; }
      .hc-hanger { width: 3px; border-radius: 2px; background: var(--rope);
        background-image: repeating-linear-gradient(to bottom, color-mix(in srgb, var(--ink) 32%, transparent) 0 1px, transparent 1px 4px);
        box-shadow: 0 0 0 .5px color-mix(in srgb, var(--ink) 25%, transparent); }
      .hc-card { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; width: 168px; min-height: 44px; padding: .7rem;
        border: 1px solid var(--hair); border-radius: 8px; background: var(--card); white-space: nowrap;
        box-shadow: 0 1px 1px color-mix(in srgb, var(--ink) 5%, transparent), 0 6px 14px -10px color-mix(in srgb, var(--ink) 30%, transparent);
        transition: border-color .3s ease, box-shadow .3s ease, translate .3s ease; }
      .hc-card:hover { border-color: color-mix(in srgb, var(--glint) 45%, transparent); translate: 0 -4px;
        box-shadow: 0 12px 26px -14px color-mix(in srgb, var(--ink) 45%, transparent); }
      .hc-card img { width: 32px; height: 32px; border-radius: 7px; border: 1px solid var(--hair); pointer-events: none; }
      .hc-card strong { color: var(--ink); font-size: 14px; font-weight: 500; line-height: 1.25; }
      .hc-card small { display: block; color: var(--ink-faint); font-size: 12px; line-height: 1.35; transition: color .3s ease; }
      .hc-card:hover small { color: var(--glint); }
      @media (prefers-reduced-motion: reduce) { .hc-card { transition: none; } }`;

    const scroller = document.createElement("div");
    scroller.className = "hc";
    const rig = document.createElement("div");
    rig.className = "hc-rig";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    // the grab band first, under the rope's own five strokes
    const layers = ["grab", "shadow", "body", "twist", "twist", "hi"].map((cls) => {
      const el = document.createElementNS(SVGNS, "path");
      el.setAttribute("class", cls);
      svg.append(el);
      return el;
    });
    layers[3].setAttribute("transform", "translate(0,-0.75)");
    layers[4].setAttribute("transform", "translate(0,0.75)");
    layers[4].setAttribute("stroke-dashoffset", "2.95");
    layers[5].setAttribute("transform", "translate(0,-1.35)");
    const band = layers[0];

    const list = document.createElement("ul");
    const items: HTMLLIElement[] = [], knots: HTMLSpanElement[] = [], swings: HTMLDivElement[] = [];
    const hangers: HTMLSpanElement[] = [], marks: HTMLImageElement[] = [], cardEls: HTMLDivElement[] = [];
    let hover = -1;
    CARDS.forEach(([name, note, key], i) => {
      const li = document.createElement("li");
      const knot = document.createElement("span");
      knot.className = "hc-knot";
      const swing = document.createElement("div");
      swing.className = "hc-swing";
      const hanger = document.createElement("span");
      hanger.className = "hc-hanger";
      const card = document.createElement("div");
      card.className = "hc-card";
      const img = document.createElement("img");
      img.src = icon(key); img.alt = ""; img.width = 32; img.height = 32; img.draggable = false;
      const text = document.createElement("span");
      const strong = document.createElement("strong");
      strong.textContent = name;
      const small = document.createElement("small");
      small.textContent = note;
      text.append(strong, small);
      card.append(img, text);
      swing.append(hanger, card);
      li.append(knot, swing);
      list.append(li);
      swing.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hover = i; wake(); } });
      swing.addEventListener("pointerleave", () => { if (hover === i) hover = -1; });
      cardEls.push(card); items.push(li); knots.push(knot); swings.push(swing); hangers.push(hanger); marks.push(img);
    });
    rig.append(svg, list);
    scroller.append(rig);
    stage.append(style, scroller);

    const angle = new Float32Array(N), vel = new Float32Array(N);
    const ky = new Float32Array(N), kvel = new Float32Array(N);
    let pts: [number, number][] = [];
    let ropeGrab = -1, raf = 0, last = 0, acc = 0, clock = 0, onScreen = true;
    let lastScroll = 0, scrollDx = 0;

    function layout() {
      const wide = scroller.clientWidth >= 600;
      scroller.classList.toggle("hc-wide", wide);
      const span = wide ? 4 : 3, sag = Number(p.sag) * (wide ? 1 : 2 / 3);
      items.forEach((li, i) => { li.style.marginTop = `${droopAt(i, span, sag)}px`; });
      hangers.forEach((h, i) => { h.style.height = `${hangerFor(i, Number(p.hanger))}px`; });
      // knot centres in rig px, measured with the lift taken out
      items.forEach((li, i) => { li.style.display = i < n ? "" : "none"; });
      // Fewer cards, bigger cards: scale them to share the width, never past the stage height.
      // At the full set they sit at their real size and the row scrolls, as on alcun.dev.
      cardEls.forEach((c) => { c.style.zoom = ""; });
      const cw = cardEls[0].offsetWidth, ch = cardEls[0].offsetHeight;
      const pad = wide ? 256 : 96;
      const fitW = ((scroller.clientWidth - pad) / n - 10) / cw;
      const fitH = (scroller.clientHeight * 0.6 - Number(p.hanger) - 60) / ch;
      const z = Math.max(1, Math.min(fitW, fitH, 4));
      cardEls.forEach((c) => { c.style.zoom = String(z); });
      const box = rig.getBoundingClientRect();
      pts = knots.slice(0, n).map((k, i) => {
        const r = k.getBoundingClientRect();
        return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2 - ky[i]];
      });
      drawRope();
    }

    function drawRope() {
      if (!pts.length) return;
      const W = rig.offsetWidth;
      const y = (i: number) => pts[i][1] + ky[i];
      let d = `M${-RUN_PAST} ${(pts[0][1] - 13).toFixed(1)} L${pts[0][0].toFixed(1)} ${y(0).toFixed(1)}`;
      // Quadratic with the control BELOW the knots: the rope hangs in a swag between boards.
      for (let i = 1; i < n; i++) {
        const px = pts[i - 1][0], py = y(i - 1), x = pts[i][0], yy = y(i);
        const load = Math.min((Math.abs(angle[i - 1]) + Math.abs(angle[i])) * 0.18, 3);
        d += ` Q${(px + (x - px) / 2).toFixed(1)} ${(Math.max(py, yy) + 4 + load).toFixed(1)} ${x.toFixed(1)} ${yy.toFixed(1)}`;
      }
      d += ` L${(W + RUN_PAST).toFixed(1)} ${(pts[n - 1][1] - 13).toFixed(1)}`;
      for (const l of layers) l.setAttribute("d", d);
    }

    function step() {
      clock += 1 / 60;
      const dx = scrollDx; scrollDx = 0;
      const cap = Number(p.maxAngle), damp = Number(p.damping), coup = Number(p.coupling), pull = Number(p.pull), amp = Number(p.breeze);
      for (let i = 0; i < n; i++) {
        const rest = hover === i ? 0 : breezeAt(i, clock, amp);
        // longer hanger, slower swing, like a real pendulum
        let a = (rest - angle[i]) * (0.2 / hangerFor(i, 18));
        if (i > 0) a += (angle[i - 1] - angle[i]) * coup;
        if (i < n - 1) a += (angle[i + 1] - angle[i]) * coup;
        a += -dx * pull * (0.75 + (i % 3) * 0.18); // scroll throws them, unevenly so never as one slab
        vel[i] = (vel[i] + a) * (hover === i ? 0.9 : damp);
        angle[i] = Math.max(-cap, Math.min(cap, angle[i] + vel[i]));
      }
      // The rope chain: each knot pulled back to the line and dragging its neighbours; the gutter exits stay tied off.
      const k = Number(p.ropeK), rd = Number(p.ropeDamp), max = Number(p.lift);
      for (let i = 0; i < n; i++) {
        if (i === ropeGrab) continue;
        let a = -ky[i] * k;
        a += ((i > 0 ? ky[i - 1] : 0) - ky[i]) * 0.05;
        a += ((i < n - 1 ? ky[i + 1] : 0) - ky[i]) * 0.05;
        kvel[i] = (kvel[i] + a) * rd;
        ky[i] = Math.max(-max, Math.min(max, ky[i] + kvel[i]));
      }
    }

    function paint() {
      for (let i = 0; i < n; i++) {
        swings[i].style.transform = `rotate(${angle[i].toFixed(3)}deg)`;
        marks[i].style.transform = `rotate(${(-angle[i] * 0.55).toFixed(3)}deg)`; // the icon hangs plumb, like a weighted sign
        items[i].style.transform = `translateY(${ky[i].toFixed(2)}px)`;
      }
      drawRope();
    }

    function tick(now: number) {
      acc += Math.min(100, last ? now - last : STEP);
      last = now;
      while (acc >= STEP) { step(); acc -= STEP; }
      paint();
      raf = requestAnimationFrame(tick);
    }
    function wake() {
      if (still || raf || !onScreen) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    }
    function sleep() { cancelAnimationFrame(raf); raf = 0; }

    // brushing the cursor across the row knocks whatever you pass
    const brush = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || drag.active) return;
      const x = e.clientX - rig.getBoundingClientRect().left;
      let near = 0, best = Infinity;
      pts.forEach(([px], i) => { const d = Math.abs(px - x); if (d < best) { best = d; near = i; } });
      if (best > 90) return;
      const kick = Math.max(-1.4, Math.min(1.4, e.movementX * 0.05));
      vel[near] -= kick;
      if (near > 0) vel[near - 1] -= kick * 0.4;
      if (near < n - 1) vel[near + 1] -= kick * 0.4;
    };

    // Mouse drag scrolls the row with a flick glide; touch keeps native scrolling.
    const drag = { active: false, x: 0, start: 0, lastX: 0, lastT: 0, v: 0 };
    let glide = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.target === band) return;
      cancelAnimationFrame(glide);
      Object.assign(drag, { active: true, x: e.clientX, start: scroller.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 });
      scroller.setPointerCapture(e.pointerId);
      scroller.classList.add("dragging");
    };
    const move = (e: PointerEvent) => {
      if (!drag.active) return;
      scroller.scrollLeft = drag.start - (e.clientX - drag.x);
      const now = performance.now(), dt = now - drag.lastT;
      if (dt > 0) drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX; drag.lastT = now;
    };
    const up = () => {
      if (!drag.active) return;
      drag.active = false;
      scroller.classList.remove("dragging");
      if (still) return;
      let v = drag.v * 16;
      const go = () => {
        v *= 0.94;
        scroller.scrollLeft -= v;
        if (Math.abs(v) > 0.2) glide = requestAnimationFrame(go);
      };
      if (Math.abs(v) > 1) glide = requestAnimationFrame(go);
    };
    const onScroll = () => {
      scrollDx += scroller.scrollLeft - lastScroll;
      lastScroll = scroller.scrollLeft;
    };

    // The rope band lifts the nearest knot vertically and never drags the row.
    const ropeDown = (e: PointerEvent) => {
      const x = e.clientX - rig.getBoundingClientRect().left;
      let near = -1, best = Infinity;
      pts.forEach(([px], i) => { const d = Math.abs(px - x); if (d < best) { best = d; near = i; } });
      if (near < 0) return;
      e.stopPropagation(); e.preventDefault();
      ropeGrab = near;
      band.setPointerCapture(e.pointerId);
      scroller.classList.add("held");
    };
    const ropeMove = (e: PointerEvent) => {
      if (ropeGrab < 0) return;
      e.preventDefault();
      // fingers can report buttons=0 mid-drag; only a mouse with no button means a lost pointer-up
      if (e.pointerType === "mouse" && e.buttons === 0) return ropeUp(e);
      const want = e.clientY - rig.getBoundingClientRect().top - pts[ropeGrab][1];
      const max = Number(p.lift);
      ky[ropeGrab] = Math.max(-max, Math.min(max, want));
      kvel[ropeGrab] = 0;
      if (still) paint();
    };
    const ropeUp = (e?: PointerEvent) => {
      if (ropeGrab < 0) return;
      try { if (e && band.hasPointerCapture(e.pointerId)) band.releasePointerCapture(e.pointerId); } catch { /* nothing held */ }
      ropeGrab = -1;
      scroller.classList.remove("held");
      if (still) { ky.fill(0); paint(); }
    };
    const holdTouch = (e: TouchEvent) => { if (ropeGrab >= 0) e.preventDefault(); };

    band.addEventListener("pointerdown", ropeDown);
    band.addEventListener("pointermove", ropeMove);
    band.addEventListener("pointerup", ropeUp);
    band.addEventListener("pointercancel", ropeUp);
    band.addEventListener("touchmove", holdTouch, { passive: false });
    addEventListener("pointerup", ropeUp);
    scroller.addEventListener("pointerdown", down);
    scroller.addEventListener("pointermove", move);
    scroller.addEventListener("pointerup", up);
    scroller.addEventListener("pointercancel", up);
    scroller.addEventListener("pointermove", brush);
    scroller.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(layout);
    ro.observe(scroller);
    const io = new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen) wake(); else sleep();
    });
    io.observe(stage);

    // start part-way through the breeze rather than all at rest
    clock = 3;
    for (let i = 0; i < n; i++) angle[i] = breezeAt(i, clock, Number(p.breeze));
    layout();
    paint();
    wake();

    return {
      update(next) {
        const relayout = next.sag !== p.sag || next.hanger !== p.hanger || next.count !== p.count;
        p = next;
        n = Number(p.count) || N;
        if (relayout) layout();
        if (still) paint();
      },
      reset() {
        vel.fill(0); ky.fill(0); kvel.fill(0);
        for (let i = 0; i < n; i++) angle[i] = breezeAt(i, clock, Number(p.breeze));
        scroller.scrollLeft = 0;
        paint();
      },
      destroy() {
        sleep();
        cancelAnimationFrame(glide);
        ro.disconnect();
        io.disconnect();
        removeEventListener("pointerup", ropeUp);
        scroller.remove();
        style.remove();
      },
    };
  },
};
