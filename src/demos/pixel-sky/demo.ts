// The alcun.dev pixel banner's sky: its time-of-day palette stops, its rounded moon disc with craters and phase carve, its cloud sprite. The headland, lighthouse and city are left on the site.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

type Pal = { sky1: string; sky2: string; sky3: string; sky4: string; haze: string; sun: string; sunGlow: string; cloud: string; sea1: string; sea2: string; sea3: string; sea4: string; city: string; cityDark: string };
const SKY: Record<string, Pal> = {
  night: { sky1: "#1f2942", sky2: "#232d48", sky3: "#27324f", sky4: "#2b3856", haze: "#33425f", sun: "#e9ecd9", sunGlow: "#9fb0c9", cloud: "#3c4763", sea1: "#3a4963", sea2: "#324158", sea3: "#2b394e", sea4: "#243144", city: "#2a3346", cityDark: "#232b3c" },
  dawn: { sky1: "#f3d6c2", sky2: "#f0cabb", sky3: "#ecbcb2", sky4: "#e6b0ab", haze: "#dfa9a6", sun: "#f7e0a0", sunGlow: "#f6cf9e", cloud: "#f3ddcf", sea1: "#a9b3bd", sea2: "#94a1ad", sea3: "#818f9c", sea4: "#70808d", city: "#aaa6b2", cityDark: "#948f9f" },
  day: { sky1: "#bcd4e6", sky2: "#c8dbe9", sky3: "#d5e2ec", sky4: "#e3eae9", haze: "#ebe7dd", sun: "#f6e3a9", sunGlow: "#f3dcb0", cloud: "#f7efe4", sea1: "#b3bcc0", sea2: "#9fabb0", sea3: "#8b99a0", sea4: "#7c8b93", city: "#aeb6bb", cityDark: "#9aa3a9" },
  sunset: { sky1: "#f5d3a6", sky2: "#f2bd92", sky3: "#eca580", sky4: "#e58c76", haze: "#d9786c", sun: "#f7d68a", sunGlow: "#f4b98a", cloud: "#f0c6aa", sea1: "#b6a097", sea2: "#9d8a86", sea3: "#847779", sea4: "#6c646c", city: "#978c90", cityDark: "#81787f" },
  dusk: { sky1: "#3b3a5e", sky2: "#4a4166", sky3: "#6b4c68", sky4: "#8f5560", haze: "#a35c55", sun: "#f0c07a", sunGlow: "#c98a6e", cloud: "#6b5570", sea1: "#5a4f63", sea2: "#4c4456", sea3: "#3f3949", sea4: "#332f3d", city: "#4a4356", cityDark: "#3b3646" },
  predawn: { sky1: "#2b3450", sky2: "#35405e", sky3: "#46506e", sky4: "#5f6478", haze: "#78737f", sun: "#d9d3c4", sunGlow: "#9aa0b4", cloud: "#4a5268", sea1: "#47506a", sea2: "#3d465d", sea3: "#343c50", sea4: "#2c3344", city: "#3a4256", cityDark: "#2f3648" },
};
const STOPS = [
  { t: 0, s: "night", n: 1 }, { t: 4.5, s: "night", n: 1 }, { t: 5.6, s: "predawn", n: 0.78 }, { t: 6.8, s: "dawn", n: 0.42 },
  { t: 8.2, s: "day", n: 0 }, { t: 17, s: "day", n: 0 }, { t: 18.4, s: "sunset", n: 0.22 }, { t: 19.6, s: "dusk", n: 0.68 },
  { t: 21, s: "night", n: 1 }, { t: 24, s: "night", n: 1 },
];

const hx = (a: string, b: string, f: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((A >> s) & 255) * (1 - f) + ((B >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};
function at(hour: number) {
  let i = 0;
  while (i < STOPS.length - 2 && !(hour >= STOPS[i].t && hour < STOPS[i + 1].t)) i++;
  const a = STOPS[i], b = STOPS[i + 1], f = (hour - a.t) / (b.t - a.t);
  const pal = Object.fromEntries(Object.keys(SKY.day).map((k) => [k, hx(SKY[a.s][k as keyof Pal], SKY[b.s][k as keyof Pal], f)])) as Pal;
  return { pal, night: a.n + (b.n - a.n) * f };
}
/** Mean-synodic phase, 0 new, 0.5 full. alcun.dev uses a full lunar model; this is within about a day. */
const meanPhase = (d = new Date()) => ((((d.getTime() / 86400000 - 10962.2) / 29.530589) % 1) + 1) % 1;

function rand(seed: number) {
  let s = seed | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const demo: Demo = {
  title: "Pixel sky",
  description: "The alcun.dev pixel sky. Scrub the hour and watch dawn, day, sunset and the moon's real phase.",
  origin: "From the alcun.dev banner.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "hour", label: "Hour", min: 0, max: 24, step: 0.05, value: 21.5 },
    { type: "toggle", key: "timelapse", label: "Timelapse", value: false },
    { type: "range", key: "speed", label: "Hours a second", min: 0.1, max: 6, step: 0.1, value: 1.2 },
    { type: "range", key: "phase", label: "Moon phase", min: 0, max: 1, step: 0.005, value: 0.38 },
    { type: "toggle", key: "tonight", label: "Tonight's moon", value: false },
    { type: "range", key: "pixel", label: "Pixel size", min: 2, max: 24, step: 1, value: 7, unit: "px" },
    { type: "range", key: "disc", label: "Disc size", min: 2, max: 20, step: 1, value: 6 },
    { type: "range", key: "arc", label: "Arc height", min: 0, max: 1, step: 0.01, value: 0.6 },
    { type: "range", key: "horizon", label: "Horizon", min: 0.25, max: 0.85, step: 0.01, value: 0.55 },
    { type: "range", key: "clouds", label: "Clouds", min: 0, max: 12, step: 1, value: 4 },
    { type: "range", key: "drift", label: "Drift", min: 0, max: 8, step: 0.1, value: 1.5 },
    { type: "range", key: "stars", label: "Stars", min: 0, max: 200, step: 1, value: 40 },
    { type: "range", key: "twinkle", label: "Twinkle", min: 0, max: 4, step: 0.1, value: 1.2 },
    { type: "toggle", key: "craters", label: "Craters", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", imageRendering: "pixelated" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;
    let GW = 0, GH = 0, raf = 0, last = 0, time = 0, hour = Number(p.hour);
    let stars: { x: number; y: number; ph: number }[] = [];
    let clouds: { x: number; y: number }[] = [];

    function layout() {
      const r = stage.getBoundingClientRect(), px = Number(p.pixel);
      GW = Math.max(16, Math.ceil(r.width / px)); GH = Math.max(12, Math.ceil(r.height / px));
      canvas.width = GW; canvas.height = GH;
      const rnd = rand(7), hz = Math.floor(GH * Number(p.horizon));
      stars = Array.from({ length: Number(p.stars) }, () => ({ x: Math.floor(rnd() * GW), y: Math.floor(rnd() * hz * 0.8), ph: rnd() * 7 }));
      clouds = Array.from({ length: Number(p.clouds) }, () => ({ x: rnd() * (GW + 14) - 14, y: Math.floor(2 + rnd() * hz * 0.45) }));
      draw();
    }

    const px = (x: number, y: number, c: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const rect = (x: number, y: number, w: number, h: number, c: string, a = 1) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    function disc(cx: number, cy: number, r: number, c: string, a = 1, round = true) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        if (round && ((Math.abs(dx) === r && dy === 0) || (Math.abs(dy) === r && dx === 0))) continue; // no compass tips on the moon
        px(cx + dx, cy + dy, c, a);
      }
    }

    function draw() {
      const { pal, night } = at(((hour % 24) + 24) % 24);
      const hz = Math.floor(GH * Number(p.horizon));
      ctx.clearRect(0, 0, GW, GH);
      // sky in the banner's five bands, scaled to the horizon
      const bands: [number, string][] = [[6, pal.sky1], [6, pal.sky2], [7, pal.sky3], [6, pal.sky4], [5, pal.haze]];
      let y = 0;
      bands.forEach(([h, c], i) => { const hh = i === 4 ? hz - y : Math.round((h / 30) * hz); rect(0, y, GW, hh, c); y += hh; });
      // stars, only at night
      const tw = Number(p.twinkle);
      for (const s of stars) px(s.x, s.y, pal.sun, night * night * (0.55 + 0.45 * Math.sin(time * tw * 2 + s.ph)));
      // sun by day (6 to 20), moon by night, each on its own arc
      const h = ((hour % 24) + 24) % 24, r = Number(p.disc);
      const sunP = (h - 6) / 14, moonP = ((h - 18 + 24) % 24) / 12;
      const pos = (t: number) => ({ x: GW * (0.1 + t * 0.8), y: hz - Math.sin(t * Math.PI) * hz * Number(p.arc) + r });
      if (sunP > 0 && sunP < 1 && night <= 0.6) {
        const s = pos(sunP);
        disc(s.x, s.y, Math.round(r * 1.5), pal.sunGlow, 0.5 * (1 - night), false);
        disc(s.x, s.y, r, pal.sun, 1 - night, false);
      }
      if (moonP > 0 && moonP < 1 && night > 0.6) {
        const m = pos(moonP), mx = Math.round(m.x), my = Math.round(m.y);
        disc(mx, my, Math.round(r * 1.33), pal.sunGlow, 0.5 * night);
        disc(mx, my, r, pal.sun, night);
        if (p.craters) for (const [cx, cy, w, hh] of [[-2, -2, 2, 2], [2, 1, 1, 1], [-1, 3, 1, 1], [3, 0, 1, 1], [1, -1, 1, 1]]) {
          const k = r / 6; rect(mx + Math.round(cx * k), my + Math.round(cy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(hh * k)), pal.sunGlow, 0.65 * night);
        }
        // carve the unlit side with sky: the terminator is an ellipse from the phase
        const ph = p.tonight ? meanPhase() : Number(p.phase), waxing = ph < 0.5, cos = Math.cos(ph * 2 * Math.PI);
        for (let dy = -r; dy <= r; dy++) {
          const X = Math.sqrt(Math.max(0, r * r - dy * dy)), xt = (waxing ? 1 : -1) * X * cos;
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            if ((Math.abs(dx) === r && dy === 0) || (Math.abs(dy) === r && dx === 0)) continue;
            const lit = waxing ? dx > xt : dx < xt;
            if (!lit) { const by = my + dy; px(mx + dx, by, by < hz ? pal.sky3 : pal.sea1, night); }
          }
        }
      }
      // clouds: the banner's three-row sprite
      for (const c of clouds) { rect(c.x + 2, c.y, 6, 2, pal.cloud); rect(c.x, c.y + 2, 12, 2, pal.cloud); rect(c.x + 1, c.y + 4, 9, 2, pal.cloud); }
      // sea in four bands, with a little shimmer
      const sea = [pal.sea1, pal.sea2, pal.sea3, pal.sea4], sh = GH - hz;
      sea.forEach((c, i) => rect(0, hz + Math.floor((i * sh) / 4), GW, Math.ceil(sh / 4) + 1, c));
      for (let x = 0; x < GW; x += 3) { const yy = hz + 1 + ((x * 7 + Math.floor(time * 2)) % Math.max(1, sh - 1)); px(x + (Math.floor(time * 3 + x) % 3), yy, pal.haze, 0.35); }
      ctx.globalAlpha = 1;
    }

    const moving = () => !reducedMotion() && (Boolean(p.timelapse) || Number(p.drift) > 0 || (Number(p.twinkle) > 0 && Number(p.stars) > 0));
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now; time += dt;
      if (p.timelapse) hour = (hour + dt * Number(p.speed)) % 24;
      for (const c of clouds) { c.x += dt * Number(p.drift); if (c.x > GW + 2) c.x = -14; }
      draw();
      raf = moving() ? requestAnimationFrame(frame) : 0;
    }
    const wake = () => { if (!raf && moving()) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    layout();
    wake();

    return {
      update(next) {
        const relayout = ["pixel", "stars", "clouds", "horizon"].some((k) => next[k] !== p[k]);
        if (next.hour !== p.hour) hour = Number(next.hour);
        p = next;
        if (relayout) layout(); else draw();
        wake();
      },
      reset() { hour = Number(p.hour); time = 0; layout(); wake(); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); },
    };
  },
};
