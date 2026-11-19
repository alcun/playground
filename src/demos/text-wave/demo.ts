import type { Demo, Params } from "../../lib/types";
import { onThemeChange, reducedMotion, tokens } from "../../lib/theme";

// Public domain: Ariel's song from The Tempest.
const TEXT =
  "Full fathom five thy father lies; Of his bones are coral made; Those are pearls that were his eyes; " +
  "Nothing of him that doth fade; But doth suffer a sea-change; Into something rich and strange; " +
  "Sea-nymphs hourly ring his knell; Ding-dong; Hark now I hear them; Ding-dong bell";

type Line = { chars: string; glint: boolean[] };

/** Split on ; . , or newlines, run the words together, and mark glint words. */
function lines(text: string, glintWords: string): Line[] {
  const glints = glintWords.toLowerCase().split(/\s+/).filter(Boolean);
  const out = text
    .split(/[;.,\n]+/)
    .map((s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((s) => s.length > 2)
    .map((chars) => {
      const glint = new Array<boolean>(chars.length).fill(false);
      for (const w of glints) {
        for (let at = chars.indexOf(w); at >= 0; at = chars.indexOf(w, at + 1)) glint.fill(true, at, at + w.length);
      }
      return { chars, glint };
    });
  return out.length ? out : [{ chars: "playground", glint: new Array(10).fill(false) }];
}

export const demo: Demo = {
  title: "Text wave",
  description: "Two ASCII swells passing each other, with lines of text streaming through one side.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "cell", label: "Cell size", min: 8, max: 32, step: 1, value: 16, unit: "px" },
    { type: "range", key: "amplitude", label: "Height", min: 0, max: 200, step: 1, value: 76, unit: "px" },
    { type: "range", key: "frequency", label: "Frequency", min: 0.001, max: 0.02, step: 0.0005, value: 0.006 },
    { type: "range", key: "ripple", label: "Ripple", min: 0, max: 80, step: 1, value: 25, unit: "px" },
    { type: "range", key: "thickness", label: "Thickness", min: 20, max: 240, step: 1, value: 92, unit: "px" },
    { type: "range", key: "gap", label: "Centre gap", min: 0, max: 0.45, step: 0.01, value: 0.23 },
    { type: "range", key: "speed", label: "Speed", min: 0, max: 4, step: 0.05, value: 1 },
    { type: "range", key: "fps", label: "Frame rate", min: 5, max: 60, step: 1, value: 20 },
    { type: "toggle", key: "letters", label: "Letters", value: true },
    { type: "text", key: "symbols", label: "Symbols", value: ".:o*%#@" },
    { type: "text", key: "text", label: "Text", value: TEXT },
    { type: "text", key: "glint", label: "Glint", value: "coral pearls rich strange bell" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    // Posed for its thumbnail: bigger cells read at card size.
    if (document.documentElement.classList.contains("thumb")) p = { ...p, cell: 22, amplitude: 110, thickness: 130 };
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    stage.append(canvas);
    const ctx = canvas.getContext("2d")!;

    let width = 0, height = 0, frame = 0, last = 0;
    let text = lines(String(p.text), String(p.glint));
    let colour = tokens(["ink", "ink-faint", "accent"]);

    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = r.width;
      height = r.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(last);
    }

    function draw(time: number) {
      ctx.clearRect(0, 0, width, height);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const speed = Number(p.speed);
      const drift = time * 0.00065 * speed;
      const cellX = Number(p.cell), cellY = cellX * 1.19;
      const half = width / 2;
      // Calmer on narrow screens, where a full swell leaves one side low and the other high.
      const reach = Math.min(1, width / 1100);
      const amp = Number(p.amplitude), freq = Number(p.frequency), ripple = Number(p.ripple);
      const thick = Number(p.thickness), gap = Number(p.gap);
      const symbols = String(p.symbols) || ".";
      const textStep = speed > 0 ? Math.floor((time * speed) / 260) : 0;
      ctx.font = `500 ${Math.round(cellY)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;

      for (const side of [-1, 1]) {
        for (let row = 0, y = cellY / 2; y < height; row++, y += cellY) {
          for (let col = 0, lx = cellX / 2; lx < half; col++, lx += cellX) {
            const x = side === -1 ? lx : half + lx;
            const envelope = 0.7 + 0.3 * Math.sin((Math.PI * x) / width);
            const fromCentre = Math.abs(x - half);
            // The two swells merge into a flat line at the centre, and part around it.
            const merge = gap > 0 ? Math.min(1, fromCentre / (width * gap)) : 1;
            const swell = side * merge * reach * (
              Math.sin(fromCentre * freq - drift) * amp * envelope +
              Math.sin(fromCentre * freq * 2.17 + drift * 0.6) * ripple
            );
            const centre = height * 0.5 + swell;
            const distance = Math.abs(y - centre);
            const thickness = (thick + thick * 0.24 * Math.sin(x * 0.01 + drift * 0.7)) * envelope * (0.55 + 0.45 * merge);
            if (distance > thickness) continue;
            const strength = 1 - distance / thickness;
            const grain = Math.abs((Math.sin(col * 17.13 + row * 78.77) * 43758.55) % 1);
            const shade = Math.max(0, Math.min(1, strength * 0.82 + grain * 0.18));
            const alpha = (0.2 + shade * 0.43) * envelope;

            let glyph = symbols[Math.min(symbols.length - 1, Math.floor(shade * symbols.length))];
            let fill = colour["ink-faint"];
            let a = alpha;
            if (side === 1 && p.letters && shade > 0.34) {
              const line = text[(row * 7 + Math.floor(time / 18000)) % text.length];
              const n = line.chars.length;
              const i = (((col - textStep) % n) + n) % n;
              glyph = line.chars[i];
              fill = line.glint[i] ? colour.accent : colour.ink;
              a = line.glint[i] ? Math.min(1, alpha * 1.35) : alpha * 1.1;
            } else if (side === -1 && (col * 7 + row * 11) % 13 === 0) {
              fill = colour.accent;
              a = alpha * 0.85;
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = fill;
            ctx.fillText(glyph, x, y);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function tick(time: number) {
      if (time - last >= 1000 / Number(p.fps)) {
        draw(time);
        last = time;
      }
      frame = requestAnimationFrame(tick);
    }
    function start() {
      cancelAnimationFrame(frame);
      if (reducedMotion() || Number(p.speed) === 0) draw(last);
      else frame = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const offTheme = onThemeChange(() => {
      colour = tokens(["ink", "ink-faint", "accent"]);
      draw(last);
    });
    start();

    return {
      update(next) {
        if (next.text !== p.text || next.glint !== p.glint) text = lines(String(next.text), String(next.glint));
        p = next;
        start();
      },
      destroy() {
        cancelAnimationFrame(frame);
        ro.disconnect();
        offTheme();
        canvas.remove();
      },
    };
  },
};
