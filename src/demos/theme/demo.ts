// The alcun.dev theme panel (ThemeToggle.tsx, PixelModeIcon.tsx and the __phPaint engine in SiteLayout.astro):
// four pixel mode chips and a 24 hour scrub that repaints the page. The palettes and stops are copied from the site.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

type Mode = "auto" | "day" | "sunset" | "night" | "time";
const ORDER: Exclude<Mode, "time">[] = ["auto", "day", "sunset", "night"];
type Rect = [number, number, number, number];
const ICONS: Record<Exclude<Mode, "time">, Rect[]> = {
  day: [[3, 3, 3, 3], [4, 0, 1, 2], [4, 7, 1, 2], [0, 4, 2, 1], [7, 4, 2, 1], [1, 1, 1, 1], [7, 1, 1, 1], [1, 7, 1, 1], [7, 7, 1, 1]],
  night: [[3, 1, 3, 1], [2, 2, 2, 1], [1, 3, 2, 3], [2, 6, 2, 1], [3, 7, 3, 1], [6, 1, 1, 1], [6, 7, 1, 1]],
  sunset: [[0, 6, 9, 1], [3, 4, 3, 2], [4, 3, 1, 1], [4, 0, 1, 2], [1, 3, 1, 1], [7, 3, 1, 1], [1, 8, 2, 1], [6, 8, 2, 1]],
  auto: [[4, 0, 1, 2], [1, 1, 1, 1], [0, 4, 2, 1], [1, 7, 1, 1], [4, 7, 1, 2], [3, 3, 2, 3], [5, 2, 1, 1], [6, 3, 1, 3], [5, 6, 1, 1]],
};
const SKY: Record<string, string[]> = { // sky1..sky4, haze
  night: ["#1f2942", "#232d48", "#27324f", "#2b3856", "#33425f"],
  dawn: ["#f3d6c2", "#f0cabb", "#ecbcb2", "#e6b0ab", "#dfa9a6"],
  day: ["#bcd4e6", "#c8dbe9", "#d5e2ec", "#e3eae9", "#ebe7dd"],
  sunset: ["#f5d3a6", "#f2bd92", "#eca580", "#e58c76", "#d9786c"],
  dusk: ["#3b3a5e", "#4a4166", "#6b4c68", "#8f5560", "#a35c55"],
  predawn: ["#2b3450", "#35405e", "#46506e", "#5f6478", "#78737f"],
};
const CKEYS = ["paper", "ink", "inkSoft", "inkFaint", "line", "lineStrong", "gold"] as const;
type Chrome = Record<(typeof CKEYS)[number], string>;
const CHROME: Record<string, Chrome> = {
  dawn: { paper: "#bfaaa2", ink: "#1c1512", inkSoft: "#473b35", inkFaint: "#61534b", line: "#a9928a", lineStrong: "#967f77", gold: "#7d5237" },
  day: { paper: "#f2f2f2", ink: "#1f1f1f", inkSoft: "#545454", inkFaint: "#858585", line: "#e2e2e2", lineStrong: "#d0d0d0", gold: "#a8825a" },
  sunset: { paper: "#c2a48f", ink: "#1a120e", inkSoft: "#45332b", inkFaint: "#5f4c41", line: "#ac8c76", lineStrong: "#9b7a63", gold: "#7a4620" },
  dusk: { paper: "#3a3247", ink: "#f0e8e2", inkSoft: "#c2b4b2", inkFaint: "#9c8f9a", line: "#4a4058", lineStrong: "#5b5068", gold: "#d9a473" },
  predawn: { paper: "#262d3c", ink: "#e8eae2", inkSoft: "#b5b8b3", inkFaint: "#909494", line: "#343c4c", lineStrong: "#454e60", gold: "#cbac80" },
  night: { paper: "#14161e", ink: "#e6e2d6", inkSoft: "#b0ada2", inkFaint: "#8a877e", line: "#242834", lineStrong: "#323746", gold: "#c9a36a" },
};
const DARK: Record<string, boolean> = { night: true, dusk: true, predawn: true };
const STOPS = [
  { t: 0, s: "night", n: 1 }, { t: 4.5, s: "night", n: 1 }, { t: 5.6, s: "predawn", n: 0.78 }, { t: 6.8, s: "dawn", n: 0.42 },
  { t: 8.2, s: "day", n: 0 }, { t: 17, s: "day", n: 0 }, { t: 18.4, s: "sunset", n: 0.22 }, { t: 19.6, s: "dusk", n: 0.68 },
  { t: 21, s: "night", n: 1 }, { t: 24, s: "night", n: 1 },
];
const MODE_HOUR = { day: 13, sunset: 18.75, night: 1 } as const;

const hx = (a: string, b: string, f: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((A >> s) & 255) * (1 - f) + ((B >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};
function seg(h: number) {
  let i = 0;
  while (i < STOPS.length - 2 && !(h >= STOPS[i].t && h < STOPS[i + 1].t)) i++;
  const a = STOPS[i], b = STOPS[i + 1];
  return { a: a.s, b: b.s, f: (h - a.t) / (b.t - a.t), n: a.n + (b.n - a.n) * ((h - a.t) / (b.t - a.t)) };
}
/** The site's paint: sky between the two stops, chrome only within the current polarity unless `hold` is off. */
function paintAt(hour: number, hold: boolean) {
  const { a, b, f, n } = seg(hour);
  const sky = SKY.day.map((_, i) => hx(SKY[a][i], SKY[b][i], f));
  const dark = n > 0.5;
  let la = a, lb = b;
  if (hold) {
    if (!!DARK[la] !== dark) la = lb;
    if (!!DARK[lb] !== dark) lb = la;
    if (!!DARK[la] !== dark) la = lb = dark ? "night" : "day";
  }
  const chrome = Object.fromEntries(CKEYS.map((k) => [k, hx(CHROME[la][k], CHROME[lb][k], f)])) as Chrome;
  return { sky, chrome, night: n };
}
const fmt = (h: number) => {
  const H = Math.floor(h) % 24, M = Math.floor((h % 1) * 60);
  return `${H % 12 || 12}:${String(M).padStart(2, "0")}${H < 12 ? "am" : "pm"}`;
};
const icon = (m: Exclude<Mode, "time">, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 9 9" fill="currentColor" style="shape-rendering:crispEdges;display:block" aria-hidden="true">${ICONS[m].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")}</svg>`;

export const demo: Demo = {
  title: "Theme",
  description: "The alcun.dev theme panel. Pick a mode or scrub the day and the whole page repaints.",
  updated: "2026-11-24",
  tile: 680,
  controls: [
    { type: "range", key: "hour", label: "Hour", min: 0, max: 23.9, step: 0.05, value: 18.9 },
    { type: "toggle", key: "clock", label: "Follow clock", value: false },
    { type: "toggle", key: "timelapse", label: "Timelapse", value: false },
    { type: "range", key: "speed", label: "Hours a second", min: 0.1, max: 6, step: 0.1, value: 1 },
    { type: "toggle", key: "hold", label: "Hold polarity", value: true },
    { type: "range", key: "pixel", label: "Pixel size", min: 1, max: 6, step: 1, value: 2, unit: "px" },
    { type: "range", key: "fade", label: "Fade", min: 0, max: 2000, step: 50, value: 300, unit: "ms" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    let mode: Mode = "time", hour = Number(p.hour), raf = 0, last = 0;
    const root = document.createElement("div");
    Object.assign(root.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", padding: "16px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" });
    root.innerHTML = `
      <div data-page style="width:min(100%,440px);border-radius:6px;overflow:hidden;border:1px solid;box-shadow:0 10px 40px rgb(0 0 0/.18)">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid" data-rule>
          <span data-ink style="font-weight:700;font-size:13px;letter-spacing:.02em">alcun.dev</span>
          <button type="button" data-btn style="display:grid;place-items:center;width:44px;height:44px;margin:-10px -8px;background:none;border:0;cursor:pointer;color:inherit"></button>
        </div>
        <svg data-sky viewBox="0 0 48 12" preserveAspectRatio="none" style="display:block;width:100%;height:64px;shape-rendering:crispEdges" aria-hidden="true"></svg>
        <div style="padding:14px 12px 4px;display:grid;gap:8px">
          <span data-soft style="height:7px;width:72%;border-radius:2px"></span>
          <span data-soft style="height:7px;width:54%;border-radius:2px"></span>
          <span data-faint style="height:7px;width:63%;border-radius:2px"></span>
        </div>
        <div data-panel role="group" aria-label="theme and time of day" style="margin:12px;padding:10px;border:1px solid;border-radius:4px;display:grid;gap:8px">
          <div data-chips style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px"></div>
          <div style="position:relative;height:44px;display:grid;align-items:center">
            <svg data-track viewBox="0 0 48 6" preserveAspectRatio="none" style="width:100%;height:14px;shape-rendering:crispEdges;display:block;border:1px solid" aria-hidden="true"></svg>
            <span data-handle style="position:absolute;top:50%;translate:-50% -50%;pointer-events:none;padding:2px;border:1px solid"></span>
            <input data-scrub type="range" min="0" max="23.9" step="0.0833" aria-label="time of day" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:ew-resize;margin:0">
          </div>
          <div data-ticks style="display:flex;justify-content:space-between;font-size:10px"><span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span></div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
            <span data-time></span>
            <button type="button" data-now style="min-height:44px;padding:0 10px;border:1px solid;border-radius:3px;background:none;font:inherit;cursor:pointer">now</button>
          </div>
        </div>
      </div>`;
    stage.append(root);
    const $ = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
    const $$ = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));
    const page = $("[data-page]"), btn = $<HTMLButtonElement>("[data-btn]"), skyEl = $<SVGSVGElement>("[data-sky]");
    const chips = $("[data-chips]"), track = $<SVGSVGElement>("[data-track]"), handle = $("[data-handle]");
    const scrub = $<HTMLInputElement>("[data-scrub]"), timeEl = $("[data-time]"), nowBtn = $<HTMLButtonElement>("[data-now]");
    track.innerHTML = Array.from({ length: 48 }, (_, i) => `<rect x="${i}" y="0" width="1.02" height="6" fill="${paintAt((i + 0.5) / 2, true).sky[0]}"/>`).join("");
    for (const m of ORDER) {
      const c = document.createElement("button");
      c.type = "button"; c.dataset.mode = m;
      Object.assign(c.style, { display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", minHeight: "44px", border: "1px solid", borderRadius: "3px", background: "none", font: "inherit", fontSize: "11px", cursor: "pointer", color: "inherit" });
      chips.append(c);
      c.onclick = () => pick(m);
    }

    const clockHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
    function shownHour() {
      if (mode === "auto") return clockHour();
      if (mode === "time") return hour;
      return MODE_HOUR[mode];
    }
    function pick(m: Exclude<Mode, "time">) { mode = m; paint(); }
    function paint() {
      const h = shownHour(), px = Number(p.pixel);
      const { sky, chrome: c, night } = mode === "day" || mode === "sunset" || mode === "night"
        ? (() => { const s = mode === "sunset" ? "sunset" : mode; const r = paintAt(h, true); return { sky: SKY[s], chrome: CHROME[s], night: r.night }; })()
        : paintAt(h, p.hold as boolean);
      const fade = `${Number(p.fade)}ms`;
      Object.assign(page.style, { background: c.paper, color: c.ink, borderColor: c.lineStrong, transition: `background ${fade}, color ${fade}` });
      root.style.background = c.line;
      $$("[data-rule]").forEach((e) => (e.style.borderColor = c.line));
      $$("[data-soft]").forEach((e) => (e.style.background = c.inkSoft));
      $$("[data-faint]").forEach((e) => (e.style.background = c.inkFaint));
      $("[data-panel]").style.borderColor = c.lineStrong;
      $("[data-ticks]").style.color = c.inkFaint;
      track.style.borderColor = c.lineStrong;
      // the banner: five bands, a sun or moon on the same arc as the site
      const t = night > 0.5 ? (((h < 6.5 ? h + 24 : h) - 19.1) / 11.4) : (h - 6.5) / 12.6;
      const k = Math.max(0, Math.min(1, t)), cx = Math.round(4 + k * 40), cy = Math.round(9 - Math.sin(k * Math.PI) * 7);
      skyEl.innerHTML = sky.map((col, i) => `<rect x="0" y="${i * 2.4}" width="48" height="2.5" fill="${col}"/>`).join("") +
        `<rect x="${cx - 1}" y="${cy - 1}" width="3" height="3" fill="${night > 0.5 ? "#e9ecd9" : "#f6e3a9"}"/>`;
      const iconMode: Exclude<Mode, "time"> = mode === "time" ? (night > 0.5 ? "night" : "day") : mode;
      btn.innerHTML = icon(iconMode, 9 * px);
      btn.setAttribute("aria-label", `theme: ${mode === "time" ? "pinned" : mode}`);
      btn.style.color = c.ink;
      for (const ch of Array.from(chips.children) as HTMLButtonElement[]) {
        const m = ch.dataset.mode as Exclude<Mode, "time">, on = m === mode;
        ch.innerHTML = `${icon(m, Math.max(9, 5 * px + 1))}<span>${m === "sunset" ? "dusk" : m}</span>`;
        ch.setAttribute("aria-pressed", String(on));
        Object.assign(ch.style, { background: on ? c.ink : "transparent", color: on ? c.paper : c.ink, borderColor: on ? c.ink : c.lineStrong });
      }
      handle.innerHTML = icon(night > 0.5 ? "night" : "day", Math.max(9, 6 * px + 1));
      Object.assign(handle.style, { left: `${(h / 24) * 100}%`, background: c.paper, color: c.gold, borderColor: c.ink });
      scrub.value = String(h);
      timeEl.textContent = mode === "auto" ? `${fmt(h)} · now` : fmt(h);
      Object.assign(nowBtn.style, { color: c.ink, borderColor: c.lineStrong, opacity: mode === "auto" ? ".45" : "1" });
      nowBtn.disabled = mode === "auto";
    }
    btn.onclick = () => pick(ORDER[(ORDER.indexOf(mode as never) + 1) % ORDER.length] ?? "auto");
    nowBtn.onclick = () => pick("auto");
    scrub.oninput = () => { mode = "time"; hour = Number(scrub.value); paint(); };

    function loop(t: number) {
      raf = 0;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
      last = t;
      if (p.timelapse && !reducedMotion()) {
        if (mode !== "time") { hour = shownHour(); mode = "time"; }
        hour = (hour + dt * Number(p.speed)) % 24;
        paint();
        raf = requestAnimationFrame(loop);
      }
    }
    const kick = () => { if (!raf && p.timelapse && !reducedMotion()) { last = 0; raf = requestAnimationFrame(loop); } };
    const tick = setInterval(() => { if (mode === "auto") paint(); }, 15000);

    function update(next: Params) {
      const prev = p;
      p = next;
      if (next.clock && !prev.clock) mode = "auto";
      else if (!next.clock && prev.clock && mode === "auto") { mode = "time"; hour = clockHour(); }
      if (next.hour !== prev.hour) { mode = "time"; hour = Number(next.hour); }
      paint();
      kick();
    }
    mode = p.clock ? "auto" : "time";
    paint();
    kick();
    return {
      update,
      reset() { mode = p.clock ? "auto" : "time"; hour = Number(p.hour); paint(); },
      destroy() { cancelAnimationFrame(raf); clearInterval(tick); root.remove(); },
    };
  },
};
