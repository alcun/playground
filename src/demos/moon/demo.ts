// The moon from Lune (monostudio lune/src/lib/moon-shader.js): a ray-traced sphere wearing NASA's LROC colour map and
// LOLA heights, lit by the Sun with a chalky lunar scattering term. Ported from Skia's SkSL to WebGL; the maths is Lune's.
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";
import albedoUrl from "./lunar-albedo.jpg?url";
import heightUrl from "./lunar-height.jpg?url";

const FRAG = `
precision highp float;
uniform sampler2D albedo, elevation;
uniform vec2 res;
uniform float radius, longitude, latitude, roll, yaw, pitch, earthshine, relief, bright, glowAmt;
uniform vec3 light;
const float PI = 3.141592653589793;
vec3 rx(vec3 p, float a) { return vec3(p.x, cos(a)*p.y - sin(a)*p.z, sin(a)*p.y + cos(a)*p.z); }
vec3 ry(vec3 p, float a) { return vec3(cos(a)*p.x + sin(a)*p.z, p.y, -sin(a)*p.x + cos(a)*p.z); }
vec3 rz(vec3 p, float a) { return vec3(cos(a)*p.x - sin(a)*p.y, sin(a)*p.x + cos(a)*p.y, p.z); }
vec2 uvFor(vec3 n) { return vec2(fract(0.5 + atan(n.x, n.z) / (2.0*PI)), 0.5 - asin(clamp(n.y, -1.0, 1.0)) / PI); }
float heightAt(vec2 uv) { return texture2D(elevation, vec2(fract(uv.x), clamp(uv.y, 0.0, 1.0))).r; }
vec3 lunarColour(vec3 view, float eyeZ) {
  vec3 n = ry(rx(rz(view, roll), -latitude), longitude);
  vec2 uv = uvFor(n);
  vec3 colour = texture2D(albedo, uv).rgb;
  float dx = heightAt(uv + vec2(1.0/1024.0, 0.0)) - heightAt(uv - vec2(1.0/1024.0, 0.0));
  float dy = heightAt(uv + vec2(0.0, 1.0/512.0)) - heightAt(uv - vec2(0.0, 1.0/512.0));
  vec3 tangent = normalize(vec3(n.z, 0.0, -n.x) + 1e-6);
  vec3 north = normalize(cross(n, tangent));
  vec3 normal = normalize(n - relief*dx*tangent + relief*dy*north);
  normal = rz(rx(ry(normal, -longitude), latitude), -roll);
  float incidence = dot(normal, light);
  float daylight = smoothstep(-0.008, 0.018, dot(view, light));
  float diffuse = max(0.0, incidence);
  float lunar = diffuse / (max(0.08, eyeZ) + diffuse + 0.001);
  vec3 ambient = earthshine * vec3(0.70, 0.82, 1.0) * (0.45 + 0.55*max(0.0, normal.z));
  vec3 lighting = ambient + vec3((0.7*sqrt(diffuse) + 0.65*lunar) * daylight);
  colour = pow(max(colour, vec3(0.0)), vec3(0.88)) * lighting * bright;
  return colour * vec3(1.02, 1.0, 0.96);
}
void main() {
  vec2 pos = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 p = (pos - res*0.5) / radius;
  p.y = -p.y;
  float rr = dot(p, p);
  float lit = clamp(light.z*0.5 + 0.5, 0.0, 1.0);
  float halo = glowAmt * lit * 0.22 * exp(-max(0.0, sqrt(rr) - 1.0) * 3.0) * step(1.0, rr);
  if (rr >= 1.0) { gl_FragColor = vec4(vec3(0.85, 0.88, 0.95) * halo, halo); return; }
  vec3 eye = vec3(p, sqrt(1.0 - rr));
  vec3 view = ry(rx(eye, -pitch), yaw);
  vec3 colour = lunarColour(view, eye.z);
  float alpha = clamp((1.0 - sqrt(rr)) * radius, 0.0, 1.0);
  gl_FragColor = vec4(colour * alpha, alpha);
}`;

/** Mean synodic month, 0 new, 0.5 full. Lune uses a full lunar model; this is within about a day. */
const meanPhase = (d = new Date()) => ((((d.getTime() / 86400000 - 10962.2) / 29.530589) % 1) + 1) % 1;
const RAD = Math.PI / 180;

export const demo: Demo = {
  title: "Moon",
  description: "The moon from Lune, on NASA's maps. Scrub the phase, drag to turn it, and let go.",
  origin: "From Lune, the moon app.",
  updated: "2026-11-24",
  controls: [
    { type: "range", key: "phase", label: "Phase", min: 0, max: 1, step: 0.002, value: 0.32 },
    { type: "toggle", key: "tonight", label: "Tonight's moon", value: false },
    { type: "range", key: "tilt", label: "Tilt", min: -180, max: 180, step: 1, value: -24, unit: "°" },
    { type: "range", key: "size", label: "Size", min: 0.15, max: 0.48, step: 0.01, value: 0.36 },
    { type: "range", key: "relief", label: "Relief", min: 0, max: 6, step: 0.05, value: 0.7 },
    { type: "range", key: "earthshine", label: "Earthshine", min: 0, max: 0.4, step: 0.005, value: 0.073 },
    { type: "range", key: "bright", label: "Brightness", min: 0.4, max: 2.5, step: 0.02, value: 1.36 },
    { type: "range", key: "lon", label: "Libration E-W", min: -8, max: 8, step: 0.1, value: 0, unit: "°" },
    { type: "range", key: "lat", label: "Libration N-S", min: -7, max: 7, step: 0.1, value: 0, unit: "°" },
    { type: "range", key: "glow", label: "Glow", min: 0, max: 3, step: 0.05, value: 1 },
    { type: "range", key: "spring", label: "Return", min: 0, max: 30, step: 0.5, value: 6 },
    { type: "colour", key: "sky", label: "Sky", value: "#0b0d14" },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
    stage.append(canvas);
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
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
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){gl_Position=vec4(a,0.0,1.0);}"));
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
    const a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog!, n);
    let loaded = 0, dead = false;
    function texture(unit: number, url: string) {
      const t = gl!.createTexture();
      gl!.activeTexture(gl!.TEXTURE0 + unit); gl!.bindTexture(gl!.TEXTURE_2D, t);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, 1, 1, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, new Uint8Array([90, 90, 90, 255]));
      const img = new Image();
      img.onload = () => {
        if (dead) return;
        gl!.activeTexture(gl!.TEXTURE0 + unit); gl!.bindTexture(gl!.TEXTURE_2D, t);
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.REPEAT);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        loaded++; wake();
      };
      img.src = url;
    }
    texture(0, albedoUrl); texture(1, heightUrl);

    let W = 1, H = 1, dpr = 1, raf = 0, last = 0;
    let yaw = 0, pitch = 0, vy = 0, vp = 0;
    let drag: { id: number; x: number; y: number; t: number } | null = null;

    function draw() {
      if (!gl) return;
      const sky = String(p.sky);
      const r = parseInt(sky.slice(1, 3), 16) / 255, g = parseInt(sky.slice(3, 5), 16) / 255, b = parseInt(sky.slice(5, 7), 16) / 255;
      gl.clearColor(r, g, b, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const phase = p.tonight ? meanPhase() : Number(p.phase), ang = 2 * Math.PI * phase, tilt = Number(p.tilt) * RAD;
      // light: waxing lights the right limb; the bright limb then turns by Tilt
      const lx = Math.sin(ang), lz = -Math.cos(ang);
      gl.uniform3f(U("light"), lx * Math.cos(tilt), lx * Math.sin(tilt), lz);
      gl.uniform2f(U("res"), canvas.width, canvas.height);
      gl.uniform1f(U("radius"), Math.min(canvas.width, canvas.height) * Number(p.size));
      gl.uniform1f(U("longitude"), Number(p.lon) * RAD); gl.uniform1f(U("latitude"), Number(p.lat) * RAD);
      gl.uniform1f(U("roll"), 0);
      gl.uniform1f(U("yaw"), yaw); gl.uniform1f(U("pitch"), pitch);
      gl.uniform1f(U("earthshine"), Number(p.earthshine)); gl.uniform1f(U("relief"), Number(p.relief));
      gl.uniform1f(U("bright"), loaded === 2 ? Number(p.bright) : 0); gl.uniform1f(U("glowAmt"), Number(p.glow));
      gl.uniform1i(U("albedo"), 0); gl.uniform1i(U("elevation"), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // After a drag the moon coasts on its own momentum, then springs back to the face we see from Earth.
    function frame(t: number) {
      raf = 0;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      const k = Number(p.spring), still = reducedMotion();
      if (!drag) {
        if (still) { yaw = pitch = vy = vp = 0; }
        else {
          vy += (-yaw * k - vy * 2 * Math.sqrt(k + 0.01) * 0.9) * dt; vp += (-pitch * k - vp * 2 * Math.sqrt(k + 0.01) * 0.9) * dt;
          if (k === 0) { vy *= 0.98; vp *= 0.98; }
          yaw += vy * dt; pitch += vp * dt;
        }
      }
      draw();
      const moving = drag || Math.abs(yaw) + Math.abs(pitch) + Math.abs(vy) + Math.abs(vp) > 1e-4;
      if (moving && !(k === 0 && !drag && Math.abs(vy) + Math.abs(vp) < 1e-3)) raf = requestAnimationFrame(frame);
    }
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      gl!.viewport(0, 0, canvas.width, canvas.height);
      wake();
    }
    const ro = new ResizeObserver(resize); ro.observe(stage);

    canvas.addEventListener("pointerdown", (e) => {
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      vy = vp = 0; canvas.style.cursor = "grabbing";
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      wake();
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const s = Math.min(W, H) * Number(p.size), now = performance.now(), dt = Math.max(0.008, (now - drag.t) / 1000);
      const dy = -(e.clientX - drag.x) / s, dp = (e.clientY - drag.y) / s;
      yaw += dy; pitch = Math.max(-1.4, Math.min(1.4, pitch + dp));
      vy = dy / dt; vp = dp / dt;
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
      wake();
    });
    const up = (e: PointerEvent) => { if (drag && e.pointerId === drag.id) { drag = null; canvas.style.cursor = "grab"; wake(); } };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    const tick = setInterval(() => { if (p.tonight) wake(); }, 60000);

    return {
      update(next) { p = next; wake(); },
      reset() { yaw = pitch = vy = vp = 0; wake(); },
      destroy() {
        dead = true; cancelAnimationFrame(raf); clearInterval(tick); ro.disconnect();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
      },
    };
  },
};
