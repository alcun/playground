// The Shangri-La Gardening gallery lightbox: open on the cached thumbnail, blurred, and sharpen when the full picture decodes. Pictures are drawn here, not the client's photos.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";

const PICS = [
  { seed: 3, sky: ["#f6c98b", "#e98a5d"], hills: ["#8a6b8f", "#5d4a6e", "#3a2f48"] },
  { seed: 8, sky: ["#bfe0f2", "#e9f4f7"], hills: ["#8fb46a", "#5f8a3a", "#355a2a"] },
  { seed: 5, sky: ["#1d2340", "#4a3f6b"], hills: ["#2c3a5a", "#1f2a44", "#141b2e"] },
  { seed: 13, sky: ["#f3e6c8", "#d9c29a"], hills: ["#b89668", "#8c6d47", "#5c472f"] },
  { seed: 21, sky: ["#9fd3c7", "#e8f3e0"], hills: ["#5c9a8b", "#3b7266", "#234a43"] },
  { seed: 34, sky: ["#f2b6a0", "#f8e1c8"], hills: ["#c77d6a", "#934f45", "#5e302d"] },
];

function rand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small landscape: sky, a sun, three ranges of hills. Same picture at any size. */
function paint(pic: (typeof PICS)[number], w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d")!;
  const r = rand(pic.seed);
  const sky = x.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, pic.sky[0]); sky.addColorStop(1, pic.sky[1]);
  x.fillStyle = sky; x.fillRect(0, 0, w, h);
  x.fillStyle = "rgba(255,250,235,.85)";
  x.beginPath(); x.arc(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.2), h * 0.08, 0, 7); x.fill();
  pic.hills.forEach((col, i) => {
    const y0 = h * (0.45 + i * 0.16), a = h * (0.05 + r() * 0.08), k = 1 + r() * 2.5, ph = r() * 7;
    x.fillStyle = col;
    x.beginPath(); x.moveTo(0, h);
    for (let px = 0; px <= w; px += w / 120) x.lineTo(px, y0 + Math.sin((px / w) * Math.PI * k + ph) * a + Math.sin((px / w) * 23 + ph) * a * 0.12);
    x.lineTo(w, h); x.fill();
  });
  return c;
}

export const demo: Demo = {
  title: "Lightbox",
  description: "Tap a picture. It opens on the blurred thumbnail and sharpens when the full one arrives.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "delay", label: "Network", min: 0, max: 4000, step: 50, value: 900, unit: "ms" },
    { type: "range", key: "thumb", label: "Thumb size", min: 4, max: 240, step: 1, value: 32, unit: "px" },
    { type: "range", key: "blur", label: "Blur", min: 0, max: 60, step: 1, value: 16, unit: "px" },
    { type: "range", key: "sharpen", label: "Sharpen", min: 0, max: 3000, step: 10, value: 550, unit: "ms" },
    { type: "range", key: "from", label: "Open from", min: 0.3, max: 1.2, step: 0.01, value: 0.9 },
    { type: "range", key: "open", label: "Open time", min: 0, max: 1500, step: 10, value: 320, unit: "ms" },
    { type: "range", key: "dim", label: "Dim", min: 0, max: 1, step: 0.01, value: 0.82 },
    { type: "range", key: "frost", label: "Frost", min: 0, max: 30, step: 0.5, value: 4, unit: "px" },
    { type: "range", key: "radius", label: "Corners", min: 0, max: 40, step: 1, value: 10, unit: "px" },
    { type: "toggle", key: "warm", label: "Preload on touch", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const root = document.createElement("div");
    Object.assign(root.style, { position: "absolute", inset: "0", overflow: "auto", padding: "16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", alignContent: "center" });
    stage.append(root);

    const full = new Map<number, string>(); // picture index -> full-size data URL, once "downloaded"
    const pending = new Map<number, Promise<string>>();
    const thumbs: HTMLImageElement[] = [];
    let box: HTMLDivElement | null = null;
    let timers: number[] = [];

    // Pretend network: the full picture takes `delay` ms to arrive, then is cached like a browser would.
    function fetchFull(i: number) {
      if (full.has(i)) return Promise.resolve(full.get(i)!);
      if (!pending.has(i)) pending.set(i, new Promise((res) => {
        timers.push(window.setTimeout(() => { const u = paint(PICS[i], 1600, 1067).toDataURL("image/jpeg", 0.85); full.set(i, u); pending.delete(i); res(u); }, Number(p.delay)));
      }));
      return pending.get(i)!;
    }

    function makeThumbs() {
      root.replaceChildren(); thumbs.length = 0;
      PICS.forEach((pic, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `Open picture ${i + 1}`);
        Object.assign(b.style, { padding: "0", border: "0", borderRadius: `${Number(p.radius) * 0.6}px`, overflow: "hidden", aspectRatio: "3 / 2", cursor: "zoom-in", background: "none" });
        const img = document.createElement("img");
        img.alt = "";
        // The thumbnail is genuinely this small; the grid scales it up, and that is the placeholder the lightbox reuses.
        img.src = paint(pic, Number(p.thumb), Math.round(Number(p.thumb) / 1.5)).toDataURL();
        Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
        b.append(img); thumbs.push(img);
        b.addEventListener("pointerdown", () => { if (p.warm) fetchFull(i); });
        b.addEventListener("click", () => open(i));
        root.append(b);
      });
    }

    function open(i: number) {
      close(true);
      const still = reducedMotion();
      const o = document.createElement("div");
      Object.assign(o.style, { position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", padding: "4%", cursor: "zoom-out", background: `rgba(20,30,15,${Number(p.dim)})`, backdropFilter: `blur(${Number(p.frost)}px)` });
      const img = document.createElement("img");
      img.alt = "";
      Object.assign(img.style, {
        maxWidth: "100%", maxHeight: "100%", aspectRatio: "3 / 2", width: "100%", objectFit: "contain", borderRadius: `${Number(p.radius)}px`,
        boxShadow: "0 24px 70px rgba(0,0,0,.5)", backgroundImage: `url(${thumbs[i].src})`, backgroundSize: "cover", backgroundPosition: "center",
        filter: `blur(${Number(p.blur)}px)`, transition: `filter ${Number(p.sharpen)}ms ease`,
      });
      // An empty, transparent image until the full one lands: the blurred thumbnail behind is what you see.
      img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      o.append(img);
      o.addEventListener("click", () => close());
      stage.append(o);
      box = o;
      if (!still) {
        o.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Number(p.open) * 0.85, easing: "ease" });
        img.animate([{ opacity: 0, transform: `scale(${Number(p.from)})` }, { opacity: 1, transform: "scale(1)" }], { duration: Number(p.open), easing: "cubic-bezier(.2,.8,.25,1)" });
      }
      fetchFull(i).then((u) => {
        if (box !== o) return;
        img.src = u;
        img.decode().catch(() => {}).then(() => { if (box === o) img.style.filter = "none"; });
      });
    }

    function close(now = false) {
      const o = box;
      if (!o) return;
      box = null;
      if (now || reducedMotion()) { o.remove(); return; }
      o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease", fill: "forwards" }).finished.then(() => o.remove());
    }

    makeThumbs();
    return {
      update(next) {
        const thumbChanged = next.thumb !== p.thumb || next.radius !== p.radius;
        if (next.delay !== p.delay) full.clear(); // a new network speed: forget what was "downloaded"
        p = next;
        if (thumbChanged) { close(true); makeThumbs(); }
      },
      reset() { close(true); full.clear(); },
      destroy() { timers.forEach(clearTimeout); close(true); root.remove(); },
    };
  },
};
