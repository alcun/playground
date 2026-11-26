// The Signalboarder footer train, rebuilt from real dots so it can be lengthened, sped up and sent more often.
// The footer's train is one picture; this one is a grid of LEDs per carriage, painted once to an offscreen canvas
// and slid across, with only the wheels drawn each frame so they can turn.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const COLS = 30; // dots per carriage, coupling included
const ROWS = 10; // roof to skirt; the wheels hang below
const EMPTY = 0, DIM = 1, LIT = 2, LAMP = 3;
const WINDOWS = [4, 12, 20]; // left edge of each 6-dot window in a middle carriage
const BOGIES = [5, 24]; // wheel pairs sit either side of these columns

type Kind = "front" | "middle" | "back";

/** One carriage as a grid of dot states. The front faces right, the way the train runs. */
function carriage(kind: Kind): Uint8Array {
  const g = new Uint8Array(COLS * ROWS);
  const set = (c: number, r: number, v: number) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) g[r * COLS + c] = v; };
  for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS - 1; c++) set(c, r, r === 8 ? DIM : LIT);
  for (let r = 1; r < 8; r++) { set(0, r, DIM); set(COLS - 1, r, DIM); } // the gangway between carriages
  const window = (c0: number, w: number) => {
    for (let r = 1; r <= 4; r++) for (let c = c0; c < c0 + w; c++) set(c, r, r === 1 || r === 4 || c === c0 || c === c0 + w - 1 ? DIM : EMPTY);
  };
  const windows = kind === "middle" ? WINDOWS : kind === "front" ? WINDOWS.slice(0, 2) : WINDOWS.slice(1);
  windows.forEach((c) => window(c, 6));
  if (kind !== "middle") {
    // The cab: a raked nose, a windscreen and a lamp. Drawn as a front, mirrored for the back.
    const nose = new Uint8Array(COLS * ROWS);
    nose.set(g);
    const at = (c: number, r: number, v: number) => { nose[r * COLS + c] = v; };
    for (let r = 0; r < 4; r++) for (let c = COLS - 4 + r; c < COLS; c++) at(c, r, EMPTY);
    for (let r = 4; r < 8; r++) at(COLS - 1, r, LIT);
    for (let r = 1; r <= 4; r++) for (let c = 21; c < COLS - 4 + r - 1; c++) at(c, r, r === 1 || r === 4 || c === 21 ? DIM : EMPTY);
    at(COLS - 2, 6, LAMP);
    if (kind === "front") return nose;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g[r * COLS + c] = nose[r * COLS + (COLS - 1 - c)];
  }
  return g;
}

export const demo: Demo = {
  title: "Train",
  description: "The Signalboarder footer train, in dots. Add carriages, speed it up and send them more often.",
  origin: "From the Signalboarder footer.",
  updated: "2026-11-26",
  controls: [
    { type: "range", key: "cars", label: "Carriages", min: 2, max: 12, step: 1, value: 4 },
    { type: "range", key: "speed", label: "Speed", min: 5, max: 300, step: 1, value: 70, unit: " dots/s" },
    { type: "range", key: "every", label: "Every", min: 0, max: 30, step: 0.5, value: 4, unit: "s" },
    { type: "range", key: "size", label: "Size", min: 0.4, max: 2.5, step: 0.05, value: 1 },
    { type: "range", key: "dot", label: "Dot size", min: 0.2, max: 1, step: 0.01, value: 0.62 },
    { type: "range", key: "dim", label: "Unlit dots", min: 0, max: 0.8, step: 0.01, value: 0.32 },
    { type: "range", key: "rock", label: "Rock", min: 0, max: 1, step: 0.01, value: 0.25 },
    { type: "toggle", key: "track", label: "Track", value: true },
    { type: "colour", key: "colour", label: "LED", value: "#f5a300" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    stage.append(canvas);
    const g = canvas.getContext("2d")!;
    const sprite = document.createElement("canvas"); // the whole train, painted once per change
    let W = 0, H = 0, dpr = 1, cell = 10, trainW = 0;
    let x = 0, travelled = 0, moving = false, raf = 0, last = 0, next = 0, timer = 0;
    const still = reducedMotion();

    function build() {
      const n = Number(p.cars), kinds: Kind[] = ["back", ...Array<Kind>(Math.max(0, n - 2)).fill("middle"), "front"];
      trainW = n * COLS * cell;
      sprite.width = Math.ceil(trainW * dpr); sprite.height = Math.ceil(ROWS * cell * dpr);
      const s = sprite.getContext("2d")!;
      s.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.fillStyle = String(p.colour);
      const r = (cell * Number(p.dot)) / 2;
      kinds.forEach((kind, k) => {
        const grid = carriage(kind);
        for (let row = 0; row < ROWS; row++) for (let c = 0; c < COLS; c++) {
          const v = grid[row * COLS + c];
          if (!v) continue;
          s.globalAlpha = v === DIM ? Number(p.dim) : 1;
          s.beginPath();
          s.arc((k * COLS + c + 0.5) * cell, (row + 0.5) * cell, v === LAMP ? r * 1.5 : r, 0, Math.PI * 2);
          s.fill();
        }
      });
      s.globalAlpha = 1;
    }

    function layout() {
      const box = stage.getBoundingClientRect();
      W = box.width; H = box.height;
      dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      cell = Math.max(3, Math.min(H / 26, W / 60, 14)) * Number(p.size); // about two carriages fit across
      build();
      if (still) x = (W - trainW) / 2;
      draw(performance.now());
    }

    function draw(now: number) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const on = String(p.colour), r = (cell * Number(p.dot)) / 2;
      const top = H / 2 - (ROWS * cell) / 2, wheelY = top + (ROWS + 0.9) * cell, wheelR = cell * 0.72;
      if (p.track) {
        // the rail: a row of dots across the whole stage, and sleepers every third dot under it
        g.fillStyle = on;
        g.globalAlpha = Math.min(1, Number(p.dim) * 2.2);
        for (let cx = cell / 2; cx < W; cx += cell) { g.beginPath(); g.arc(cx, wheelY + wheelR + cell * 0.55, r * 0.8, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = Number(p.dim);
        for (let cx = cell / 2; cx < W; cx += cell * 3) { g.beginPath(); g.arc(cx, wheelY + wheelR + cell * 1.5, r * 0.8, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
      }
      if (!moving && !still) return;
      // Rock: a slow sway on the body only, wheels stay on the rail.
      const sway = Number(p.rock) * cell * 0.18 * Math.sin(now / 140) * (moving ? 1 : 0);
      g.drawImage(sprite, x, top + sway, trainW, ROWS * cell);
      // Wheels: rings with one lit dot that turns with the distance travelled.
      const spin = travelled / wheelR, n = Number(p.cars);
      g.strokeStyle = on; g.fillStyle = on; g.lineWidth = Math.max(1, r * 0.7);
      for (let k = 0; k < n; k++) for (const b of BOGIES) for (const d of [-1.1, 1.1]) {
        const cx = x + (k * COLS + b + 0.5 + d) * cell;
        if (cx < -wheelR || cx > W + wheelR) continue;
        g.globalAlpha = 0.9;
        g.beginPath(); g.arc(cx, wheelY, wheelR, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
        g.beginPath(); g.arc(cx + Math.cos(spin) * wheelR * 0.5, wheelY + Math.sin(spin) * wheelR * 0.5, r * 0.6, 0, Math.PI * 2); g.fill();
      }
    }

    function depart() {
      clearTimeout(timer);
      moving = true; x = -trainW; travelled = 0;
      next = performance.now() + Number(p.every) * 1000;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const step = Number(p.speed) * cell * dt;
      x += step; travelled += step;
      if (x > W) {
        // Gone. The next one leaves on its timetable, or straight away if this one ran late.
        moving = false; raf = 0; draw(now);
        timer = window.setTimeout(depart, Math.max(0, next - now));
        return;
      }
      draw(now);
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    layout();
    if (!still) depart();
    return {
      update(nextP) {
        const rebuild = ["cars", "size", "dot", "dim", "colour"].some((k) => nextP[k] !== p[k]);
        p = nextP;
        if (rebuild) layout(); else draw(performance.now());
      },
      reset() { if (!still) { cancelAnimationFrame(raf); depart(); } },
      destroy() { cancelAnimationFrame(raf); clearTimeout(timer); ro.disconnect(); canvas.remove(); },
    };
  },
};
