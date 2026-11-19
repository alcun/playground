// Light woven through a dark sphere as thin glowing sheets (a warped gyroid),
// wound in shells around a leaning axis with a soft spine of light.
// Raymarched through the sphere in a fixed number of steps.

export const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

export const FRAG = `
precision highp float;
#define MAX_STEPS 128
uniform vec2 res, tilt;
uniform float time, voice, wave, twist, writing, scale;
uniform float steps, density, softness, warp, layers, spineBase, exposure;
uniform vec3 gold, cream, edge;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  vec2 frame_uv = (gl_FragCoord.xy * 2.0 - res) / min(res.x, res.y);
  vec2 uv = frame_uv / max(scale, 0.05);
  const float CAM = 2.6;
  const float FOCAL = 1.6;
  vec3 ro = vec3(0.0, 0.0, CAM);
  vec3 rd = normalize(vec3(uv, -FOCAL));

  vec3 col = vec3(0.0);
  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - 1.0);
  if (h > 0.0) {
    float sh = sqrt(h);
    float dt = 2.0 * sh / steps;
    float t = -b - sh + dt * 0.5;
    mat3 lean = rotZ(0.3 + tilt.x) * rotX(tilt.y);
    for (int i = 0; i < MAX_STEPS; i++) {
      if (float(i) >= steps) break;
      vec3 p = lean * (ro + rd * t);
      float r = length(p);
      vec3 q = rotY(twist * r * 3.1 - wave) * p;
      vec3 w = q * density;
      for (int k = 1; k < 6; k++) {
        float fk = float(k);
        if (fk > layers) break;
        w += sin(w.zxy * fk * 1.1 + time * 0.35 * fk) * (warp / fk);
      }
      float g = sin(w.x) * cos(w.y) + sin(w.y) * cos(w.z) + sin(w.z) * cos(w.x);
      float sheet = softness / (g * g + softness);
      float axis = length(q.xz);
      float spine = exp(-axis * axis * 16.0) * (spineBase + 0.9 * voice + 0.6 * writing);
      float body = 1.0 - smoothstep(0.55, 1.0, r);
      float depth = float(i) / steps;
      vec3 tint = mix(gold, cream, depth);
      tint = mix(tint, edge, smoothstep(0.6, 1.0, r) * (1.0 - writing));
      tint = mix(tint, gold, writing * 0.5);
      col += tint * (sheet * 3.2 + spine * 1.2) * body * dt * (56.0 / 72.0);
      t += dt;
    }
  }
  vec3 inner = 1.0 - exp(-col * (exposure + 2.4 * voice + 1.2 * writing));

  float rs = FOCAL / sqrt(CAM * CAM - 1.0);
  float d = length(uv);
  float aa = 2.0 / (min(res.x, res.y) * max(scale, 0.05));
  float disc = 1.0 - smoothstep(rs - aa, rs + aa, d);
  inner += mix(gold, cream, 0.5) * smoothstep(rs * 0.8, rs, d) * disc * (0.12 + 0.2 * voice);
  float halo = exp(-max(d - rs, 0.0) * 6.0) * (1.0 - disc) * (0.2 + 0.45 * voice + 0.3 * writing);
  vec3 halo_col = mix(gold, cream, 0.3) * halo;

  vec3 rgb = inner * disc + halo_col;
  float a = disc + (1.0 - disc) * clamp(max(halo_col.r, max(halo_col.g, halo_col.b)) * 1.2, 0.0, 1.0);
  gl_FragColor = vec4(rgb, a);
}
`;
