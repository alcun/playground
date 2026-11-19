import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";
import { FRAG, VERT } from "./shader";

const UNIFORMS = [
  "res", "tilt", "time", "voice", "wave", "twist", "writing", "scale",
  "steps", "density", "softness", "warp", "layers", "spineBase", "exposure", "gold", "cream", "edge",
] as const;

const rgb = (hex: Params[string]) => {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
};

export const demo: Demo = {
  title: "Orb",
  description: "Light woven through a dark sphere. Press and hold to talk to it; let go and it turns gold.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "size", label: "Size", min: 0.2, max: 1.4, step: 0.01, value: 0.85 },
    { type: "range", key: "voice", label: "Voice", min: 0, max: 1, step: 0.01, value: 0 },
    { type: "range", key: "writing", label: "Gold", min: 0, max: 1, step: 0.01, value: 0 },
    { type: "range", key: "twist", label: "Twist", min: 0, max: 5, step: 0.05, value: 1 },
    { type: "range", key: "wind", label: "Wind speed", min: 0, max: 5, step: 0.05, value: 0.45 },
    { type: "range", key: "flow", label: "Flow speed", min: 0, max: 4, step: 0.05, value: 0.6 },
    { type: "range", key: "density", label: "Sheet density", min: 0.5, max: 8, step: 0.1, value: 2.4 },
    { type: "range", key: "softness", label: "Sheet softness", min: 0.002, max: 0.4, step: 0.001, value: 0.035 },
    { type: "range", key: "warp", label: "Warp", min: 0, max: 1.5, step: 0.01, value: 0.45 },
    { type: "range", key: "layers", label: "Warp layers", min: 0, max: 5, step: 1, value: 5 },
    { type: "range", key: "spine", label: "Spine", min: 0, max: 2, step: 0.01, value: 0.35 },
    { type: "range", key: "exposure", label: "Exposure", min: 0.2, max: 6, step: 0.05, value: 1.5 },
    { type: "range", key: "steps", label: "Ray steps", min: 8, max: 128, step: 1, value: 56 },
    { type: "toggle", key: "follow", label: "Lean towards the pointer", value: true },
    { type: "colour", key: "gold", label: "Core", value: "#d9a366" },
    { type: "colour", key: "cream", label: "Depth", value: "#f5e8cc" },
    { type: "colour", key: "edge", label: "Edge light", value: "#9e96c2" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", touchAction: "none" });
    stage.append(canvas);

    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      const note = Object.assign(document.createElement("p"), { textContent: "This needs WebGL." });
      Object.assign(note.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", margin: "0", color: "var(--ink-soft)" });
      stage.append(note);
      return { update() {}, destroy() { canvas.remove(); note.remove(); } };
    }
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

    // Eased state, as in the original: the sliders set targets and resting
    // values, holding the pointer adds a fake voice on top, letting go turns it gold.
    let held = false, voice = 0, gold = 0, goldUntil = 0, twist = Number(p.twist);
    let wave = 0, clock = 0, scale = Number(p.size);
    let tx = 0, ty = 0, txT = 0, tyT = 0;
    let last = performance.now(), frame = 0;

    function size() {
      // The shader is soft; a low DPR is plenty and keeps phones cool.
      const dpr = Math.min(devicePixelRatio || 1, 1.25);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl!.viewport(0, 0, w, h);
    }

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.1) * (reducedMotion() ? 0.25 : 1);
      last = now;
      // Holding the pointer is a pretend voice: a wobble that never sits still.
      const talk = held ? 0.55 + 0.35 * Math.sin(now * 0.011) * Math.sin(now * 0.0037) : 0;
      const voiceT = Math.max(Number(p.voice), talk);
      voice += (voiceT - voice) * (voiceT > voice ? 0.35 : 0.07);
      const goldT = Math.max(Number(p.writing), now < goldUntil ? 1 : 0);
      gold += (goldT - gold) * 0.1;
      const releasing = now < goldUntil;
      twist += ((releasing ? 0.35 : Number(p.twist) * (1 + 1.6 * voice)) - twist) * 0.08;
      wave += dt * (releasing ? 3.2 : Number(p.wind) + 2 * voice);
      clock += dt * Number(p.flow) * (1 + 2 * voice);
      scale += (Number(p.size) - scale) * 0.12;
      tx += (txT - tx) * 0.05;
      ty += (tyT - ty) * 0.05;

      size();
      const g = gl!;
      g.uniform2f(u.res, canvas.width, canvas.height);
      g.uniform2f(u.tilt, tx, ty);
      g.uniform1f(u.time, clock);
      g.uniform1f(u.voice, voice);
      g.uniform1f(u.wave, wave);
      g.uniform1f(u.twist, twist);
      g.uniform1f(u.writing, gold);
      g.uniform1f(u.scale, scale);
      g.uniform1f(u.steps, Number(p.steps));
      g.uniform1f(u.density, Number(p.density));
      g.uniform1f(u.softness, Number(p.softness));
      g.uniform1f(u.warp, Number(p.warp));
      g.uniform1f(u.layers, Number(p.layers));
      g.uniform1f(u.spineBase, Number(p.spine));
      g.uniform1f(u.exposure, Number(p.exposure));
      g.uniform3f(u.gold, ...rgb(p.gold));
      g.uniform3f(u.cream, ...rgb(p.cream));
      g.uniform3f(u.edge, ...rgb(p.edge));
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
      frame = requestAnimationFrame(draw);
    }

    const onMove = (e: PointerEvent) => {
      if (!p.follow || reducedMotion()) { txT = tyT = 0; return; }
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      txT = -Math.max(-1, Math.min(1, x)) * 0.35;
      tyT = Math.max(-1, Math.min(1, y)) * 0.35;
    };
    const onDown = (e: PointerEvent) => {
      held = true;
      goldUntil = 0;
      canvas.setPointerCapture(e.pointerId);
      onMove(e);
    };
    const onUp = () => {
      if (!held) return;
      held = false;
      goldUntil = performance.now() + 1600;
    };
    const onLeave = () => { txT = tyT = 0; };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(draw);

    return {
      update(next) { p = next; },
      reset() { gold = 0; goldUntil = 0; voice = 0; wave = 0; clock = 0; txT = tyT = 0; },
      destroy() {
        cancelAnimationFrame(frame);
        canvas.remove();
      },
    };
  },
};
