// The Tide app's water shader (monostudio tide/src/lib/water-shader.mjs), its fixed constants made uniforms.
// Adapted there from eugenemindset/water. Copyright (c) 2026 Eugene Yarovoi. MIT licence, see LICENSE in this folder.
export const FRAG = `
precision highp float;

uniform vec2  uRes;        // canvas size, device px
uniform float uDPR;
uniform sampler2D uSurf;   // 64x1, 16-bit encoded surface y (normalized by uRes.y)
uniform sampler2D uText;     // number texture (white, alpha), sharp
uniform vec4  uTextRect;   // x, y, w, h in device px (top-left origin)
uniform float uTime;
uniform float uBend;    // refraction strength (Tide: 62)
uniform float uBezel;   // edge zone depth (Tide: 110)
uniform float uSway;    // whole-scene sway (Tide: 6)
uniform float uLight;   // light beam (Tide: 0.20)
uniform float uGlow;    // rim and halo (Tide: 1)
uniform float uSpread;  // dispersion smear (Tide: 0.46)

const float NSURF = 128.0;

float decodeY(vec2 uv) {
  vec4 c = texture2D(uSurf, uv);
  // JS encodes clamp(y/H, 0, 1.2)/1.2 -> decode back with the same 1.2 headroom
  return (c.r * 255.0 * 256.0 + c.g * 255.0) / 65535.0 * 1.2 * uRes.y;
}

float surfY(float x) {
  // Catmull-Rom through 4 neighbors: no polyline corners ("steps") on waves
  float f = clamp(x / uRes.x, 0.0, 1.0) * (NSURF - 1.0);
  float i1 = floor(f);
  float t = f - i1;
  float i0 = max(i1 - 1.0, 0.0);
  float i2 = min(i1 + 1.0, NSURF - 1.0);
  float i3 = min(i1 + 2.0, NSURF - 1.0);
  float y0 = decodeY(vec2((i0 + 0.5) / NSURF, 0.5));
  float y1 = decodeY(vec2((i1 + 0.5) / NSURF, 0.5));
  float y2 = decodeY(vec2((i2 + 0.5) / NSURF, 0.5));
  float y3 = decodeY(vec2((i3 + 0.5) / NSURF, 0.5));
  return y1 + 0.5 * t * (y2 - y0 + t * (2.0 * y0 - 5.0 * y1 + 4.0 * y2 - y3 + t * (3.0 * (y1 - y2) + y3 - y0)));
}

float textA(vec2 p) {
  vec2 tuv = (p - uTextRect.xy) / uTextRect.zw;
  if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0) return 0.0;
  return texture2D(uText, tuv).a;
}

vec3 bg(vec2 p) {
  float t = p.y / uRes.y;
  return mix(vec3(0.0), vec3(0.028, 0.060, 0.068), smoothstep(0.18, 0.80, t));
}

vec3 scene(vec2 p) {
  return mix(bg(p), vec3(1.0), textA(p));
}

void water() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); // top-left origin
  float sy = surfY(p.x);
  float d = p.y - sy;                                     // depth under surface

  // anti-aliased edge: blend air/water over ~1.5px instead of a hard step
  float aa = smoothstep(-0.75 * uDPR, 0.75 * uDPR, d);
  if (aa <= 0.001) {
    gl_FragColor = vec4(scene(p), 1.0);
    return;
  }
  d = max(d, 0.0);

  float px = 2.0 * uDPR;
  float slope = (surfY(p.x + px) - surfY(p.x - px)) / (2.0 * px);
  float xw = p.x / uDPR;

  // --- physical lens profile (kube.io): CONVEX SQUIRCLE bezel + Snell ---
  // h(t) = (1-(1-t)^4)^(1/4) — the profile Apple favors: the flat->curve
  // transition is gentle, so refraction fades smoothly with no hard band
  float bezel = uBezel * uDPR;                 // how deep the edge zone reaches
  float tb = clamp(d / bezel, 0.0, 1.0);
  float omt = 1.0 - tb;
  float omt3 = omt * omt * omt;
  float h4 = max(1.0 - omt * omt3, 1e-5);              // 1-(1-t)^4
  float hp = omt3 * pow(h4, -0.75);                    // squircle slope h'(t)
  float th1 = atan(hp);                                // angle of incidence
  float th2 = asin(clamp(sin(th1) / 1.5, -1.0, 1.0));  // Snell, n = 1.5
  float mag = uBend * uDPR * tan(th1 - th2);            // deviation -> px shift

  // gentle whole-scene sway: slow, small, grows slightly with depth
  float amp = 1.0 - exp(-d / (90.0 * uDPR));
  float dx = (
      sin(p.y / uDPR * 0.045 + xw * 0.03 + uTime * 0.35)
    + 0.5 * sin(p.y / uDPR * 0.016 - xw * 0.012 + uTime * 0.22)
  ) * uSway * uDPR * amp;

  // --- refraction, kube.io style: displacement along the INWARD border
  // normal (deeper into the water), magnitude from the squircle bezel.
  // The whole scene is displaced as one — the digit bends because it is
  // part of the scene, not via a separate overlay trick.
  vec2 dirIn = normalize(vec2(-slope * 0.5, 1.0)); // inward normal, damped x

  // waves still bend the underwater picture a little
  float wave = sy - 0.5 * (surfY(p.x - 34.0 * uDPR) + surfY(p.x + 34.0 * uDPR));
  float waveW = exp(-d / (150.0 * uDPR));
  vec2 disp = vec2(dx, 0.0) + dirIn * mag
            + vec2(-slope * 14.0 * uDPR, wave * 1.8) * waveW;

  // --- dispersion a la junni / Maxime Heckel: MANY samples smeared
  // along the refraction direction, each channel smearing over a
  // different length (R shortest, B longest). The average is a silky
  // directional blur with built-in rainbow fringes — no grain, no
  // pre-blurred textures, the digit itself bends and melts at the rim.
  vec3 col;
  vec2 q = p + disp;
  if (mag < 0.6 * uDPR) {
    // deep water: no bend — one clean sample, keep the GPU cool
    col = scene(q);
  } else {
    col = vec3(0.0);
    vec2 smear = dirIn * mag * uSpread;
    for (int i = 0; i < 14; i++) {
      float slide = float(i) / 14.0;
      vec2 sR = q + smear * slide;
      vec2 sG = q + smear * slide * 2.0;
      vec2 sB = q + smear * slide * 3.1;
      col.r += mix(bg(sR).r, 1.0, textA(sR));
      col.g += mix(bg(sG).g, 1.0, textA(sG));
      col.b += mix(bg(sB).b, 1.0, textA(sB));
    }
    col /= 14.0;
    // the averaging washes colors out — saturate via luminance; the
    // boost fades with the bend so there is no seam against deep water
    float lum = dot(col, vec3(0.2125, 0.7154, 0.0721));
    float satAmt = 1.0 + 0.55 * clamp(mag / (22.0 * uDPR), 0.0, 1.0);
    col = mix(vec3(lum), col, satAmt);
  }

  // --- geometric water tint: deepens toward the bottom for real depth ---
  float depthT = clamp(d / (uRes.y * 0.55), 0.0, 1.0);
  vec3 deep = vec3(0.012, 0.090, 0.12);                    // deep sea teal
  col = mix(col, vec3(0.15, 0.52, 0.59), 0.13);            // cyan water cast
  col = mix(col, deep, 0.06 + 0.30 * depthT);

  // --- volumetric light: a wide, diffused beam falls from the upper
  // left; it lights up the shallows, scatters, drifts slowly, and dies
  // out with depth — the body of water reads as a lit volume, not a fill
  float sub = exp(-d / (uRes.y * 0.28));                  // light penetration
  float bx = p.x / uRes.x - 0.30 + 0.18 * (d / uRes.y);   // beam leans right
  float beam = exp(-bx * bx / 0.13);                      // soft, unfocused
  float lightAmt = sub * (0.40 + 0.60 * beam);
  // slow shimmer, like light through a moving surface
  lightAmt *= 0.86 + 0.14 * sin(p.x * 0.010 / uDPR - uTime * 0.5 + d * 0.006);
  col += vec3(0.42, 0.85, 0.92) * lightAmt * uLight;

  // --- edge glow: thin bright rim + wide soft halo, teal, symmetric ---
  vec2 n = normalize(vec2(slope, -1.0));
  vec2 L = normalize(vec2(0.707, -0.707));                // light at -45 deg
  float spec = pow(abs(dot(n, L)), 4.0);
  vec3 teal = vec3(0.62, 0.97, 0.98);
  // uneven, living edge: brightness drifts along the waterline over time
  float wob = 0.62 + 0.38 * sin(xw * 0.021 + uTime * 0.5)
                          * sin(xw * 0.0074 - uTime * 0.31);
  float rim  = exp(-d / ((4.0 + 3.0 * wob) * uDPR));      // rim width varies too
  float halo = exp(-d / (46.0 * uDPR));                   // soft inner glow
  col = mix(col, teal, clamp(uGlow * halo * (0.06 + 0.14 * spec) * (0.55 + 0.45 * wob), 0.0, 1.0));
  col = mix(col, teal, clamp(uGlow * rim  * (0.16 + 0.42 * spec) * (0.45 + 0.55 * wob), 0.0, 1.0));

  col *= 1.0 - smoothstep(0.72, 0.99, p.y / uRes.y);
  gl_FragColor = vec4(mix(scene(p), col, aa), 1.0);
}

void main() { water(); }
`;
