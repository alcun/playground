// The water from Tide (monostudio tide/src/lib/physics.mjs and scene.mjs): a spring surface over a refracting
// number. Surface physics adapted there from Eugene Yarovoi's Water, MIT; see LICENSE in this folder.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";
import { FRAG } from "./shader";

const N = 128;

export const demo: Demo = {
  title: "Water",
  description: "The water from Tide. Tap to splash, drag sideways to tip it, and watch the number bend underneath.",
  updated: "2026-11-24",
  controls: [
    { type: "text", key: "number", label: "Number", value: "2.4" },
    { type: "text", key: "unit", label: "Unit", value: "m" },
    { type: "range", key: "level", label: "Level", min: 0, max: 1, step: 0.01, value: 0.7 },
    { type: "range", key: "bend", label: "Bend", min: 0, max: 200, step: 1, value: 62 },
    { type: "range", key: "bezel", label: "Edge depth", min: 10, max: 400, step: 5, value: 110, unit: "px" },
    { type: "range", key: "spread", label: "Rainbow", min: 0, max: 2, step: 0.01, value: 0.46 },
    { type: "range", key: "sway", label: "Sway", min: 0, max: 30, step: 0.5, value: 6 },
    { type: "range", key: "splash", label: "Splash", min: 0.2, max: 8, step: 0.1, value: 1.8 },
    { type: "range", key: "slosh", label: "Slosh", min: 0, max: 3, step: 0.05, value: 1 },
    { type: "range", key: "damping", label: "Damping", min: 0.9, max: 0.999, step: 0.001, value: 0.977 },
    { type: "range", key: "light", label: "Light", min: 0, max: 1, step: 0.01, value: 0.2 },
    { type: "range", key: "glow", label: "Glow", min: 0, max: 4, step: 0.05, value: 1 },
    { type: "toggle", key: "rain", label: "Rain", value: false },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "pointer" });
    stage.append(canvas);
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    let prog: WebGLProgram | null = null;
    if (gl) {
      try {
        const sh = (type: number, src: string) => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src); gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
          return s;
        };
        prog = gl.createProgram()!;
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 aPos; void main(){gl_Position=vec4(aPos,0.0,1.0);}"));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      } catch (err) { console.error(err); prog = null; }
    }
    if (!gl || !prog) {
      const msg = document.createElement("p");
      msg.textContent = "This needs WebGL.";
      Object.assign(msg.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", color: "var(--ink-soft)" });
      stage.append(msg);
      return { update() {}, destroy() { canvas.remove(); msg.remove(); } };
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const tex = (unit: number, filter: number) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const surf = new Uint8Array(N * 4);
    const surfTex = tex(0, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, surf);
    const textTex = tex(1, gl.LINEAR);
    const textCanvas = document.createElement("canvas"), tctx = textCanvas.getContext("2d")!;

    // surface springs: Tide's createWater, with damping and slosh exposed
    const ys = new Float32Array(N), vs = new Float32Array(N);
    let tilt = 0, tiltV = 0, tiltTo = 0, level = Number(p.level), time = 0;
    let W = 1, H = 1, dpr = 1, textW = 1, textH = 1, textDirty = true, raf = 0, lastT = 0, acc = 0;

    function splash(x: number, power: number) {
      const at = Math.round(Math.max(0, Math.min(1, x)) * (N - 1));
      for (let d = -9; d <= 9; d++) { const j = at + d; if (j >= 0 && j < N) vs[j] += power * 0.5 * (1 + Math.cos((Math.PI * d) / 9)); }
    }
    function step() {
      time += 1 / 60;
      level += (Number(p.level) - level) * 0.065;
      tiltV = (tiltV + (tiltTo - tilt) * 0.0038) * 0.9645;
      tilt += tiltV;
      if (p.rain && Math.random() < 0.08) splash(Math.random(), Number(p.splash) * (0.2 + Math.random() * 0.4));
      const damp = Number(p.damping);
      for (let i = 0; i < N; i++) { vs[i] = Math.max(-14, Math.min(14, (vs[i] - 0.018 * ys[i]) * damp)); ys[i] += vs[i]; }
      for (let pass = 0; pass < 3; pass++) for (let i = 1; i < N; i++) { const d = 0.1 * (ys[i] - ys[i - 1]); vs[i - 1] += d; vs[i] -= d; }
    }
    function uploadText() {
      const size = Math.min(112, W * 0.265);
      const label = String(p.number), unit = String(p.unit);
      textW = W; textH = size * 1.65;
      textCanvas.width = Math.ceil(textW * 2); textCanvas.height = Math.ceil(textH * 2);
      tctx.setTransform(2, 0, 0, 2, 0, 0);
      tctx.clearRect(0, 0, textW, textH);
      const big = `300 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, small = `300 ${size * 0.34}px -apple-system, "Segoe UI", sans-serif`;
      tctx.font = big; const nw = tctx.measureText(label).width;
      tctx.font = small; const uw = tctx.measureText(unit).width;
      const left = (W - nw - uw - (unit ? 10 : 0)) / 2;
      tctx.fillStyle = "#ede8e0"; tctx.textBaseline = "alphabetic";
      tctx.font = big; tctx.fillText(label, left, size * 1.16);
      tctx.font = small; tctx.fillText(unit, left + nw + 10, size * 1.16);
      gl!.activeTexture(gl!.TEXTURE1); gl!.bindTexture(gl!.TEXTURE_2D, textTex);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, textCanvas);
      textDirty = false;
    }
    function render(reduced: boolean) {
      if (!gl) return;
      if (textDirty) uploadText();
      const size = Math.min(112, W * 0.265), base = H * 0.49 - size * (level - 0.5) * 3.4, sl = Number(p.slosh); // level is measured in number heights, so it reads the same on any stage
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * W;
        const y = base + tilt * sl * (x - W / 2) + ys[i] + (reduced ? 0 : Math.sin(x * 0.016 + time * 1.1) * 1.8 + Math.sin(x * 0.007 - time * 0.6) * 1.2);
        const q = Math.round((Math.max(0, Math.min(1.2, y / H)) / 1.2) * 65535);
        surf[i * 4] = q >> 8; surf[i * 4 + 1] = q & 255; surf[i * 4 + 3] = 255;
      }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, surfTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, 1, gl.RGBA, gl.UNSIGNED_BYTE, surf);
      gl.uniform2f(U("uRes"), canvas.width, canvas.height);
      gl.uniform1f(U("uDPR"), dpr);
      gl.uniform1i(U("uSurf"), 0); gl.uniform1i(U("uText"), 1);
      gl.uniform4f(U("uTextRect"), 0, (H * 0.49 - textH / 2) * dpr, textW * dpr, textH * dpr);
      gl.uniform1f(U("uTime"), reduced ? 0 : time);
      gl.uniform1f(U("uBend"), Number(p.bend)); gl.uniform1f(U("uBezel"), Number(p.bezel));
      gl.uniform1f(U("uSway"), reduced ? 0 : Number(p.sway)); gl.uniform1f(U("uSpread"), Number(p.spread));
      gl.uniform1f(U("uLight"), Number(p.light)); gl.uniform1f(U("uGlow"), Number(p.glow));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Fixed 60 Hz physics like Tide. The shader's sway and shimmer are always moving, so the loop
    // runs while on screen; reduced motion draws still frames on interaction only.
    function loop(now: number) {
      raf = 0;
      const reduced = reducedMotion();
      acc += Math.min(100, lastT ? now - lastT : 16.667); lastT = now;
      let steps = 0;
      while (acc >= 16.667 && steps < 6) { step(); acc -= 16.667; steps++; }
      if (reduced) { tilt = 0; tiltV = 0; ys.fill(0); vs.fill(0); level = Number(p.level); }
      render(reduced);
      if (!reduced) raf = requestAnimationFrame(loop);
    }
    const wake = () => { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } };

    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      textDirty = true; wake();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    let drag: { id: number; x: number; moved: boolean } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      drag = { id: e.pointerId, x: e.clientX, moved: false };
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      if (drag.moved) { tiltTo = Math.max(-0.35, Math.min(0.35, (dx / W) * 0.6)); wake(); }
    });
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) splash((e.clientX - canvas.getBoundingClientRect().left) / W, Number(p.splash));
      tiltTo = 0; drag = null; wake();
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    return {
      update(next) {
        if (next.number !== p.number || next.unit !== p.unit) textDirty = true;
        p = next; wake();
      },
      reset() { ys.fill(0); vs.fill(0); tilt = tiltV = tiltTo = 0; level = Number(p.level); wake(); },
      destroy() {
        cancelAnimationFrame(raf); ro.disconnect();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      },
    };
  },
};
