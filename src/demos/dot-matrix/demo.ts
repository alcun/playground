// An LED departure board in Signalboarder's amber. The text is rasterised onto a grid and every cell is drawn as an LED,
// lit or dark, so resolution, dot size and glow are real knobs rather than properties of a dotty font.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

export const demo: Demo = {
  title: "Dot matrix",
  description: "A scrolling LED sign. Type your own message; every dot is its own light.",
  updated: "2026-11-26",
  controls: [
    { type: "text", key: "text", label: "Message", value: "12:04  London Euston  Platform 1  On time" },
    { type: "toggle", key: "station", label: "Station font", value: true },
    { type: "range", key: "rows", label: "LED rows", min: 5, max: 40, step: 1, value: 11 },
    { type: "range", key: "dot", label: "Dot size", min: 0.2, max: 1, step: 0.01, value: 0.72 },
    { type: "range", key: "speed", label: "Scroll", min: 0, max: 80, step: 0.5, value: 24, unit: "/s" },
    { type: "range", key: "glow", label: "Glow", min: 0, max: 3, step: 0.05, value: 0.55 },
    { type: "range", key: "dark", label: "Unlit dots", min: 0, max: 0.4, step: 0.01, value: 0.12 },
    { type: "range", key: "weight", label: "Weight", min: 300, max: 900, step: 100, value: 400 },
    { type: "range", key: "threshold", label: "Threshold", min: 0.05, max: 0.95, step: 0.01, value: 0.55 },
    { type: "range", key: "flicker", label: "Flicker", min: 0, max: 1, step: 0.01, value: 0.08 },
    { type: "toggle", key: "square", label: "Square LEDs", value: false },
    { type: "colour", key: "colour", label: "LED", value: "#ffb000" },
    { type: "colour", key: "board", label: "Board", value: "#0b0a08" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    stage.append(canvas);
    const g = canvas.getContext("2d")!;
    const raster = document.createElement("canvas"); // the message at one pixel per LED
    const rg = raster.getContext("2d", { willReadFrequently: true })!;
    let lit: Uint8Array = new Uint8Array(0), msgW = 1;
    let W = 0, H = 0, dpr = 1, cell = 8, cols = 0, raf = 0, last = 0, offset = 0;

    // Daniel Hart's Dot Matrix, the face Signalboarder uses. It is drawn on a dot grid: one dot is
    // a tenth of the font size, capitals are 7 dots tall, descenders 2 more. So at 10px (times a whole
    // scale) every font dot lands on exactly one LED. Loaded here, not at module level (see CLAUDE.md).
    const face = new FontFace("Playground Dot Matrix", "url(/fonts/dot-matrix-regular.woff2)");
    let faceReady = false;
    face.load().then((f) => { document.fonts.add(f); faceReady = true; if (p.station) { rasterise(); draw(performance.now()); } }).catch(() => {});

    function rasterise() {
      const rows = Number(p.rows), station = Boolean(p.station) && faceReady;
      const k = Math.max(1, Math.floor(rows / 9)); // whole-dot scale, so a font dot stays square
      const font = station ? `${10 * k}px "Playground Dot Matrix"` : `${Number(p.weight)} ${rows * 0.92}px ui-sans-serif, system-ui, sans-serif`;
      rg.font = font;
      const text = String(p.text) || " ";
      // Station font: one extra dark column between letters (two in all), so the glow cannot bridge them.
      const chars = [...text], gap = station ? k : 0;
      const textW = station ? chars.reduce((w, c) => w + rg.measureText(c).width + gap, 0) : rg.measureText(text).width;
      msgW = Math.max(1, Math.ceil(textW) + rows * 3); // a gap before it comes round again
      raster.width = msgW; raster.height = rows;
      rg.font = font; rg.fillStyle = "#fff";
      rg.clearRect(0, 0, msgW, rows);
      if (station) {
        rg.textBaseline = "alphabetic";
        const y = Math.floor((rows - 9 * k) / 2) + 7 * k;
        let x = 0;
        for (const c of chars) { rg.fillText(c, x, y); x += Math.round(rg.measureText(c).width) + gap; }
      }
      else { rg.textBaseline = "middle"; rg.fillText(text, 0, rows / 2 + rows * 0.04); }
      const data = rg.getImageData(0, 0, msgW, rows).data, t = (station ? 0.5 : Number(p.threshold)) * 255;
      lit = new Uint8Array(msgW * rows);
      for (let i = 0; i < lit.length; i++) lit[i] = data[i * 4 + 3] > t ? 1 : 0;
    }
    function layout() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      const rows = Number(p.rows);
      cell = Math.max(2, Math.min((H * 0.8) / rows, W / 96)); // a board shows a line, not a word
      cols = Math.ceil(W / cell);
      draw(0);
    }
    function draw(time: number) {
      const rows = Number(p.rows), on = String(p.colour), d = Number(p.dot), flick = Number(p.flicker);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = String(p.board); g.fillRect(0, 0, W, H);
      const y0 = (H - rows * cell) / 2, r = (cell * d) / 2, sq = Boolean(p.square);
      const shift = Math.floor(offset);
      const dot = (cx: number, cy: number) => { if (sq) g.fillRect(cx - r, cy - r, r * 2, r * 2); else { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); } };
      // dark LEDs first, then the lit ones on top with their glow
      g.fillStyle = on; g.globalAlpha = Number(p.dark); g.shadowBlur = 0;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) dot(x * cell + cell / 2, y0 + y * cell + cell / 2);
      g.shadowColor = on; g.shadowBlur = Number(p.glow) * cell * 0.9;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const mx = (((x + shift) % msgW) + msgW) % msgW;
        if (!lit[y * msgW + mx]) continue;
        g.globalAlpha = flick ? 1 - flick * 0.6 * (0.5 + 0.5 * Math.sin(time * 0.05 + x * 12.9898 + y * 78.233)) * ((x * 7 + y * 13 + Math.floor(time / 90)) % 5 === 0 ? 1 : 0.15) : 1;
        dot(x * cell + cell / 2, y0 + y * cell + cell / 2);
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
    }
    const moving = () => !reducedMotion() && (Number(p.speed) > 0 || Number(p.flicker) > 0);
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      offset = (offset + dt * Number(p.speed)) % msgW;
      draw(now);
      raf = moving() ? requestAnimationFrame(frame) : 0;
    }
    const wake = () => { if (!raf && moving()) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    rasterise(); layout(); wake();
    return {
      update(next) {
        const re = ["text", "rows", "weight", "threshold", "station"].some((k) => next[k] !== p[k]);
        p = next;
        if (re) rasterise();
        layout(); wake();
      },
      reset() { offset = 0; draw(performance.now()); },
      destroy() { cancelAnimationFrame(raf); ro.disconnect(); canvas.remove(); },
    };
  },
};
