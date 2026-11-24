// Vines after the Shangri-La Gardening header (Al's own generator: a wave of smooth cubics, a curl, a leaf on every anchor), with its constants turned into knobs.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const SVGNS = "http://www.w3.org/2000/svg";
const LEAF = "M0 0C3-4.2 9-5 12 0 9 5 3 4.2 0 0Z"; // stalk at origin, pointing along +x
const VINE_H = 30;
const CORNERS = ["tl", "br", "tr", "bl"] as const;

function rand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v: number) => String(Number(v.toFixed(2)));

function makeVine(seed: number, p: Params) {
  const r = rand(seed);
  const base = 17.5 + r();
  const amp = Number(p.amp) * (0.8 + r() * 0.4);
  const segs = Number(p.waves) * 2;
  const seg = Number(p.length) * (0.85 + r() * 0.3);
  const anchors = [{ x: 2, y: base, high: false }];
  for (let i = 1; i <= segs; i++) {
    const prev = anchors[i - 1], high = i % 2 === 1;
    anchors.push({ x: prev.x + seg * (0.8 + r() * 0.4), y: high ? base - amp * (0.65 + r() * 0.55) : base - r() * 2.6, high });
  }
  let d = `M${n(anchors[0].x)} ${n(anchors[0].y)}`;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i], dx = (b.x - a.x) * 0.45;
    d += i === 1 ? `C${n(a.x + dx)} ${n(a.y)} ${n(b.x - dx)} ${n(b.y)} ${n(b.x)} ${n(b.y)}` : `S${n(b.x - dx)} ${n(b.y)} ${n(b.x)} ${n(b.y)}`;
  }
  const cr = Number(p.curl) * (0.85 + r() * 0.3), f = r() < 0.5 ? 1 : -1;
  const c = (x: number, y: number) => `${n(x * cr)} ${n(y * cr * f)}`;
  if (cr > 0) d += `c${c(2.4, -0.35)} ${c(3.6, -0.1)} ${c(4.2, 0.5)} ${c(0.6, 0.6)} ${c(0, 1.2)} ${c(-0.8, 1)} ${c(-0.6, -0.16)} ${c(-0.8, -0.7)} ${c(-0.2, -1)}`;
  const last = anchors[anchors.length - 1];
  const vw = last.x + 5.6 * cr + 5;
  const leaves = anchors.slice(1).map((a) => ({
    x: a.x, y: a.y,
    angle: (a.high ? -1 : 1) * (Number(p.spread) * (0.75 + r() * 0.5)),
    scale: Number(p.leaf) * (0.85 + r() * 0.3),
    at: (a.x / vw) * 0.94,
  }));
  return { d, vw, leaves };
}

export const demo: Demo = {
  title: "Vines",
  description: "Seeded vines creeping in from the corners, a leaf opening at every turn.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "growth", label: "Growth", min: 0, max: 1, step: 0.001, value: 1 },
    { type: "toggle", key: "animate", label: "Keep growing", value: true },
    { type: "range", key: "speed", label: "Grow time", min: 1, max: 20, step: 0.5, value: 6, unit: "s" },
    { type: "range", key: "vines", label: "Vines", min: 1, max: 4, step: 1, value: 4 },
    { type: "range", key: "reach", label: "Reach", min: 0.15, max: 1, step: 0.01, value: 0.45 },
    { type: "range", key: "waves", label: "Waves", min: 1, max: 6, step: 1, value: 3 },
    { type: "range", key: "amp", label: "Amplitude", min: 0, max: 14, step: 0.1, value: 6 },
    { type: "range", key: "length", label: "Wave length", min: 10, max: 60, step: 0.5, value: 33 },
    { type: "range", key: "curl", label: "Curl", min: 0, max: 14, step: 0.1, value: 8 },
    { type: "range", key: "leaf", label: "Leaf size", min: 0, max: 1.5, step: 0.01, value: 0.62 },
    { type: "range", key: "spread", label: "Leaf angle", min: 0, max: 90, step: 1, value: 42, unit: "°" },
    { type: "range", key: "stem", label: "Stem", min: 0.3, max: 4, step: 0.05, value: 1.6 },
    { type: "range", key: "seed", label: "Seed", min: 1, max: 999, step: 1, value: 27 },
    { type: "colour", key: "stemColour", label: "Stem colour", value: "#4f6b35" },
    { type: "colour", key: "leafColour", label: "Leaf colour", value: "#6f9a3c" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("aria-hidden", "true");
    Object.assign(svg.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    stage.append(svg);
    let stems: SVGPathElement[] = [];
    let leaves: { el: SVGPathElement; at: number }[] = [];
    let raf = 0, last = 0, g = Number(p.growth), dir = 1, hold = 0;

    function build() {
      svg.replaceChildren();
      stems = []; leaves = [];
      const { width: W, height: H } = stage.getBoundingClientRect();
      for (let i = 0; i < Number(p.vines); i++) {
        const corner = CORNERS[i];
        const v = makeVine(Number(p.seed) * 7 + i * 101, p);
        const s = (W * Number(p.reach)) / v.vw;
        const right = corner[1] === "r", bottom = corner[0] === "b";
        // Rooted in its corner: mirrored so it always grows inward, leaves hanging into the page.
        const gx = right ? `translate(${W} 0) scale(${-s} ${bottom ? s : -s})` : `scale(${s} ${bottom ? s : -s})`;
        const ty = bottom ? H - VINE_H * s : VINE_H * s;
        const grp = document.createElementNS(SVGNS, "g");
        grp.setAttribute("transform", `translate(0 ${ty}) ${gx}`);
        const stem = document.createElementNS(SVGNS, "path");
        stem.setAttribute("d", v.d);
        stem.setAttribute("pathLength", "1");
        Object.assign(stem.style, { fill: "none", stroke: String(p.stemColour), strokeWidth: String(Number(p.stem)), strokeLinecap: "round", strokeDasharray: "1 1" });
        grp.append(stem);
        stems.push(stem);
        for (const l of v.leaves) {
          const at = document.createElementNS(SVGNS, "g");
          at.setAttribute("transform", `translate(${n(l.x)} ${n(l.y)}) rotate(${n(l.angle)}) scale(${n(l.scale)})`);
          const leaf = document.createElementNS(SVGNS, "path");
          leaf.setAttribute("d", LEAF);
          Object.assign(leaf.style, { fill: String(p.leafColour), transformBox: "view-box", transformOrigin: "0 0", transition: "transform .35s cubic-bezier(.3,1.6,.5,1)" });
          at.append(leaf);
          grp.append(at);
          leaves.push({ el: leaf, at: l.at });
        }
        svg.append(grp);
      }
      paint();
    }

    function paint() {
      for (const s of stems) s.style.strokeDashoffset = String(1 - g);
      for (const l of leaves) l.el.style.transform = `scale(${g >= l.at ? 1 : 0})`;
    }

    const looping = () => p.animate && !reducedMotion();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (hold > 0) hold -= dt;
      else {
        g += (dir * dt) / Number(p.speed);
        if (g >= 1) { g = 1; dir = -1; hold = 2.5; }
        if (g <= 0) { g = 0; dir = 1; hold = 0.6; }
      }
      paint();
      raf = looping() ? requestAnimationFrame(frame) : 0;
    }
    const wake = () => { if (looping() && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const ro = new ResizeObserver(build);
    ro.observe(stage);
    build();
    if (looping()) { g = 0; wake(); }

    return {
      update(next) {
        const grew = next.growth !== p.growth;
        p = next;
        if (grew) { g = Number(p.growth); if (p.animate) { cancelAnimationFrame(raf); raf = 0; } }
        build();
        if (!grew) wake();
      },
      reset() { g = looping() ? 0 : Number(p.growth); dir = 1; hold = 0; paint(); wake(); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); svg.remove(); },
    };
  },
};
