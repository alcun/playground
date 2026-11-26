import type { Demo, Params } from "../../lib/types";

// The paper grain from Al's Ensō app (monostudio/enso/src/components/Grain.js lays a
// seamless washi tile over the sheet). The app ships a baked PNG; this generates the
// tile instead: fine tooth, short flecks and long kozo fibres, wrapped so it repeats.

const mulberry = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const demo: Demo = {
  title: "Washi",
  description: "A seamless washi paper grain, generated: tooth, flecks and long kozo fibres.",
  origin: "From the Ensō app, the grain on its paper.",
  updated: "2026-11-25",
  controls: [
    { type: "range", key: "fibres", label: "Fibres", min: 0, max: 1500, step: 10, value: 320 },
    { type: "range", key: "length", label: "Length", min: 5, max: 400, step: 1, value: 110, unit: "px" },
    { type: "range", key: "curl", label: "Curl", min: 0, max: 3, step: 0.05, value: 0.7 },
    { type: "range", key: "width", label: "Fibre width", min: 0.2, max: 4, step: 0.05, value: 0.7, unit: "px" },
    { type: "range", key: "strength", label: "Strength", min: 0, max: 1, step: 0.01, value: 0.2 },
    { type: "range", key: "light", label: "Light fibres", min: 0, max: 1, step: 0.01, value: 0.8 },
    { type: "range", key: "flecks", label: "Flecks", min: 0, max: 3000, step: 10, value: 1400 },
    { type: "range", key: "tooth", label: "Tooth", min: 0, max: 0.4, step: 0.005, value: 0.05 },
    { type: "range", key: "tile", label: "Tile", min: 96, max: 640, step: 8, value: 256, unit: "px" },
    { type: "range", key: "seed", label: "Seed", min: 1, max: 999, step: 1, value: 7 },
    { type: "toggle", key: "ink", label: "Show ink", value: true },
    { type: "colour", key: "paper", label: "Paper", value: "#f5f0e8" },
    { type: "colour", key: "sumi", label: "Ink", value: "#1a1a1a" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;
    const tileCanvas = document.createElement("canvas");
    const tctx = tileCanvas.getContext("2d")!;
    let dpr = 1, frame = 0, built = false;

    // The grain is mostly transparent, light and dark both, so it reads on any paper.
    function buildTile() {
      built = true;
      const T = Math.round(Number(p.tile) * dpr);
      tileCanvas.width = tileCanvas.height = T;
      tctx.clearRect(0, 0, T, T);
      const rnd = mulberry(Number(p.seed) * 9973);
      const s = Number(p.strength), lightShare = Number(p.light);

      // tooth: per-pixel noise, half lifting and half shading the sheet
      const tooth = Number(p.tooth);
      if (tooth > 0) {
        const img = tctx.createImageData(T, T), d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = rnd(), lit = v > 0.5;
          d[i] = d[i + 1] = d[i + 2] = lit ? 255 : 0;
          d[i + 3] = Math.round(Math.abs(v - 0.5) * 2 * tooth * 255);
        }
        tctx.putImageData(img, 0, 0);
      }

      // Everything below is drawn at nine offsets so a mark crossing an edge comes back on the other side.
      const wrap = (draw: () => void) => {
        for (const ox of [-T, 0, T]) for (const oy of [-T, 0, T]) {
          tctx.save(); tctx.translate(ox, oy); draw(); tctx.restore();
        }
      };
      const tone = (a: number) => (rnd() < lightShare ? `rgba(255,255,255,${a})` : `rgba(60,45,30,${a * 0.3})`);

      // flecks: tiny short slivers, the cloudy tooth of the sheet
      const flecks = Number(p.flecks);
      tctx.lineCap = "round";
      for (let i = 0; i < flecks; i++) {
        const x = rnd() * T, y = rnd() * T, a = rnd() * Math.PI, l = (2 + rnd() * 6) * dpr;
        const c = tone(s * (0.4 + rnd() * 0.6)), w = (0.4 + rnd() * 0.8) * dpr;
        wrap(() => {
          tctx.strokeStyle = c; tctx.lineWidth = w;
          tctx.beginPath(); tctx.moveTo(x, y); tctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); tctx.stroke();
        });
      }

      // kozo fibres: long wandering hairs, each a random walk whose heading drifts by the curl
      const n = Number(p.fibres), len = Number(p.length) * dpr, curl = Number(p.curl), fw = Number(p.width) * dpr;
      for (let i = 0; i < n; i++) {
        let x = rnd() * T, y = rnd() * T, h = rnd() * Math.PI * 2;
        const L = len * (0.25 + rnd() * 0.75), steps = Math.max(4, Math.round(L / (3 * dpr))), step = L / steps;
        const pts: number[] = [x, y];
        let turn = (rnd() - 0.5) * 0.1 * curl;
        for (let k = 0; k < steps; k++) {
          turn += (rnd() - 0.5) * 0.08 * curl;
          turn *= 0.9;
          h += turn;
          x += Math.cos(h) * step; y += Math.sin(h) * step;
          pts.push(x, y);
        }
        const c = tone(s * (0.35 + rnd() * 0.65)), w = fw * (0.5 + rnd());
        wrap(() => {
          tctx.strokeStyle = c; tctx.lineWidth = w;
          tctx.beginPath(); tctx.moveTo(pts[0], pts[1]);
          for (let k = 2; k < pts.length; k += 2) tctx.lineTo(pts[k], pts[k + 1]);
          tctx.stroke();
        });
      }
    }

    function draw() {
      frame = 0;
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = String(p.paper);
      ctx.fillRect(0, 0, W, H);
      if (p.ink) {
        // A plain ink ring under the grain: ink on washi sits IN the fibres, so the grain goes over it.
        const r = Math.min(W, H) * 0.3;
        ctx.strokeStyle = String(p.sumi);
        ctx.lineWidth = r * 0.16;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(W / 2, H / 2, r, -Math.PI * 0.42, Math.PI * 1.46); ctx.stroke();
      }
      ctx.fillStyle = ctx.createPattern(tileCanvas, "repeat")!;
      ctx.fillRect(0, 0, W, H);
    }
    function render() {
      buildTile();
      if (!frame) frame = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect();
      const next = Math.min(2, devicePixelRatio || 1);
      const w = Math.round(r.width * next), h = Math.round(r.height * next);
      if (w === canvas.width && h === canvas.height && next === dpr) return;
      const rebuild = next !== dpr;
      dpr = next;
      canvas.width = w; canvas.height = h;
      if (rebuild || !built) buildTile();
      if (!frame) frame = requestAnimationFrame(draw);
    });
    ro.observe(stage);

    return {
      update(next) {
        const onlyColour = Object.keys(next).every((k) => ["paper", "sumi", "ink"].includes(k) || next[k] === p[k]);
        p = next;
        if (onlyColour) { if (!frame) frame = requestAnimationFrame(draw); } else render();
      },
      destroy() {
        cancelAnimationFrame(frame);
        ro.disconnect();
        canvas.remove();
      },
    };
  },
};
