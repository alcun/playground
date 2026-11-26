// Dally's jelly letters (monostudio dally/src/jellyScene.js and jellyPhysics.mjs): glassy three.js glyphs whose
// vertices follow a spring when you pull them. The scene, material and physics are Dally's, with the numbers exposed.
import * as THREE from "three";
import type { Demo, Params } from "../../lib/types";
import { reducedMotion } from "../../lib/theme";
import { glyph } from "./bake";

/** Dally's influence field: a soft ball around the grab point, with the back of each glyph pinned. */
function influence(x: number, y: number, z: number, px: number, py: number, pz: number, radius: number) {
  const d = Math.hypot(x - px, y - py, (z - pz) * 0.55);
  if (d >= radius) return 0;
  const t = 1 - d / radius;
  return t * t * (3 - 2 * t) * Math.max(0, Math.min(1, (z + 0.3) / 0.35));
}

type Letter = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & {
  userData: { base: Float32Array; weights: Float32Array; pull: number[]; velocity: number[]; target: number[]; active: boolean };
};

export const demo: Demo = {
  title: "Jelly letters",
  description: "Dally's jelly letters. Grab a letter, pull, and let it wobble back.",
  origin: "From Dally, where the letters wobble when you grab them.",
  updated: "2026-11-24",
  controls: [
    { type: "text", key: "text", label: "Words", value: "dally / along" },
    { type: "colour", key: "colour", label: "Jelly", value: "#78a345" },
    { type: "colour", key: "paper", label: "Paper", value: "#faf9f3" },
    { type: "range", key: "stiff", label: "Stiffness", min: 10, max: 600, step: 5, value: 145 },
    { type: "range", key: "damp", label: "Damping", min: 0.5, max: 40, step: 0.5, value: 11 },
    { type: "range", key: "reach", label: "Grab size", min: 0.2, max: 1.6, step: 0.02, value: 0.62 },
    { type: "range", key: "give", label: "Stretch", min: 0.1, max: 2.5, step: 0.05, value: 0.9 },
    { type: "range", key: "puff", label: "Puff", min: 0, max: 0.8, step: 0.02, value: 0.28 },
    { type: "range", key: "glass", label: "Glass", min: 0, max: 1, step: 0.01, value: 0.58 },
    { type: "range", key: "rough", label: "Roughness", min: 0, max: 1, step: 0.01, value: 0.25 },
    { type: "range", key: "tilt", label: "Tilt", min: 0, max: 1, step: 0.01, value: 0.4 },
    { type: "toggle", key: "breathe", label: "Breathe", value: true },
    { type: "toggle", key: "flowers", label: "Flowers", value: true },
  ],
  mount(stage, initial) {
    let p: Params = initial;
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
    stage.append(canvas);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      canvas.remove();
      const msg = document.createElement("p");
      msg.textContent = "This needs WebGL.";
      Object.assign(msg.style, { position: "absolute", inset: "0", display: "grid", placeItems: "center", color: "var(--ink-soft)" });
      stage.append(msg);
      return { update() {}, destroy() { msg.remove(); } };
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfffff5, 0x83915e, 1.1));
    const sun = new THREE.DirectionalLight(0xfff7e4, 2.3); sun.position.set(-3, 6, 8); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffffff, 2); rim.position.set(5, 2, -2); scene.add(rim);
    // Dally's tiny procedural studio: three white panels give real reflections with no assets
    const studio = new THREE.Scene();
    studio.background = new THREE.Color("#bbc5ac");
    const panelGeo = new THREE.PlaneGeometry(1, 1), panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    for (const [x, y, z, sx, sy] of [[-4, 4, 5, 3, 6], [3, 5, 2, 2, 4], [0, -3, 4, 7, 1]]) {
      const m = new THREE.Mesh(panelGeo, panelMat); m.position.set(x, y, z); m.scale.set(sx, sy, 1); m.lookAt(0, 0, 0); studio.add(m);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(studio, 0.03, 0.1, 30);
    scene.environment = env.texture;
    pmrem.dispose(); panelGeo.dispose(); panelMat.dispose();

    const material = new THREE.MeshPhysicalMaterial({ metalness: 0, thickness: 0.8, ior: 1.38, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.5, attenuationDistance: 2.2 });
    const group = new THREE.Group(); scene.add(group);
    const flowers = new THREE.Group(); group.add(flowers);
    const petalGeo = new THREE.SphereGeometry(1, 12, 8);
    const petalMat = new THREE.MeshLambertMaterial({ color: 0xfff8ed }), centreMat = new THREE.MeshLambertMaterial({ color: 0xdfbb60 }), leafMat = new THREE.MeshLambertMaterial({ color: 0x839464 });
    function flower(x: number, y: number, s: number, rot: number) {
      const f = new THREE.Group(); f.position.set(x, y, 0.4); f.scale.setScalar(s); f.rotation.set(0.25, 0.1, rot);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5, pm = new THREE.Mesh(petalGeo, petalMat);
        pm.position.set(Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0); pm.scale.set(0.14, 0.23, 0.08); pm.rotation.z = -a; f.add(pm);
      }
      const c = new THREE.Mesh(petalGeo, centreMat); c.scale.set(0.115, 0.115, 0.1); c.position.z = 0.07; f.add(c);
      flowers.add(f);
      const leaf = new THREE.Mesh(petalGeo, leafMat);
      leaf.position.set(x + 0.25 * s, y - 0.2 * s, 0.1); leaf.scale.set(0.12 * s, 0.33 * s, 0.05 * s); leaf.rotation.z = -0.7; flowers.add(leaf);
    }

    const letters: Letter[] = [];
    let fit = 1, W = 1, H = 1;
    function build() {
      selected = null;
      for (const m of letters) { group.remove(m); m.geometry.dispose(); }
      letters.length = 0; flowers.clear();
      const lines = String(p.text).toLowerCase().split("/").map((l) => l.trim().replace(/[^a-z ]/g, "")).filter(Boolean).slice(0, 4);
      if (!lines.length) lines.push("jelly");
      lines.forEach((line, row) => {
        let cursor = 0;
        const row_: Letter[] = [];
        for (const ch of line) {
          if (ch === " ") { cursor += 0.42; continue; }
          const g = glyph(ch, Number(p.puff));
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(g.position.slice(), 3).setUsage(THREE.DynamicDrawUsage));
          geo.setAttribute("normal", new THREE.Float32BufferAttribute(g.normal.slice(), 3));
          geo.setIndex(g.index);
          geo.computeBoundingBox(); geo.boundingBox!.expandByScalar(1.1);
          geo.computeBoundingSphere(); geo.boundingSphere!.radius += 1.1;
          const m = new THREE.Mesh(geo, material) as unknown as Letter;
          m.position.set(cursor + g.width / 2, (lines.length - 1) * 0.85 - row * 1.7, 0);
          m.userData = { base: g.position, weights: new Float32Array(g.position.length / 3), pull: [0, 0, 0], velocity: [0, 0, 0], target: [0, 0, 0], active: false };
          group.add(m); row_.push(m); letters.push(m);
          cursor += g.width + 0.18;
        }
        for (const m of row_) m.position.x -= cursor / 2 - 0.09;
      });
      let min = Infinity, max = -Infinity;
      for (const m of letters) { const b = m.userData.base; for (let i = 0; i < b.length; i += 3) { min = Math.min(min, m.position.x + b[i]); max = Math.max(max, m.position.x + b[i]); } }
      fit = Math.min(1, 6.5 / Math.max(0.01, max - min));
      if (letters.length) {
        const first = letters[0].position, last = letters[letters.length - 1].position, mid = letters[Math.floor(letters.length / 2)].position;
        flower(first.x - 0.08, first.y + 0.52, 0.62, -0.25); flower(last.x + 0.1, last.y + 0.37, 0.5, 0.4);
        flower(last.x + 0.35, last.y + 0.2, 0.28, 0.8); flower(first.x + 0.28, first.y + 0.4, 0.3, 0.55);
        flower(mid.x + 0.12, mid.y + 0.48, 0.38, -0.5); flower(last.x - 0.24, last.y + 0.48, 0.31, -0.3);
      }
      wake();
    }

    const ray = new THREE.Raycaster(), plane = new THREE.Plane(), origin = new THREE.Vector3(), point = new THREE.Vector3();
    let selected: Letter | null = null;
    const tiltNow = { x: 0, y: 0 }, tiltTo = { x: 0, y: 0 };
    function poke(x: number, y: number, drag: boolean) {
      ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), camera);
      if (!drag) {
        group.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        if (selected) { selected.userData.target = [0, 0, 0]; selected.userData.active = true; }
        const hit = ray.intersectObjects(letters, false)[0];
        selected = (hit?.object as Letter) ?? null;
        if (!selected || !hit) return false;
        const d = selected.userData, local = selected.worldToLocal(hit.point.clone()), r = Number(p.reach);
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
        origin.copy(local);
        for (let i = 0; i < d.weights.length; i++) d.weights[i] = influence(d.base[i * 3], d.base[i * 3 + 1], d.base[i * 3 + 2], local.x, local.y, local.z, r);
        d.target = [0, 0, -0.16]; d.active = true;
      } else if (selected && ray.ray.intersectPlane(plane, point)) {
        const delta = selected.worldToLocal(point.clone()).sub(origin);
        delta.clampLength(0, Number(p.give));
        selected.userData.target = [delta.x, delta.y, Math.min(0.45, delta.length() * 0.3)];
        selected.userData.active = true;
      }
      return !!selected;
    }

    let raf = 0, last = 0;
    const t0 = performance.now();
    function frame(t: number) {
      raf = 0;
      const dt = Math.min((t - last) / 1000 || 0.016, 0.035);
      last = t;
      const reduced = reducedMotion(), k = Number(p.stiff), c = Number(p.damp);
      let moving = false;
      for (const m of letters) {
        const d = m.userData;
        if (!d.active) continue;
        for (let a = 0; a < 3; a++) {
          if (reduced) { d.pull[a] = d.target[a]; d.velocity[a] = 0; continue; }
          d.velocity[a] += ((d.target[a] - d.pull[a]) * k - d.velocity[a] * c) * dt;
          d.pull[a] += d.velocity[a] * dt;
        }
        const settled = d.pull.every((v, i) => Math.abs(v - d.target[i]) < 1e-4) && d.velocity.every((v) => Math.abs(v) < 1e-3);
        if (settled) { d.pull = [...d.target]; d.velocity.fill(0); }
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const w = d.weights[i];
          pos.setXYZ(i, d.base[i * 3] + d.pull[0] * w, d.base[i * 3 + 1] + d.pull[1] * w, d.base[i * 3 + 2] + d.pull[2] * w);
        }
        pos.needsUpdate = true;
        m.geometry.computeVertexNormals();
        if (settled) d.active = false; else moving = true;
      }
      const tl = reduced ? 0 : Number(p.tilt);
      tiltNow.x += (tiltTo.x - tiltNow.x) * 0.12; tiltNow.y += (tiltTo.y - tiltNow.y) * 0.12;
      if (Math.abs(tiltTo.x - tiltNow.x) + Math.abs(tiltTo.y - tiltNow.y) > 1e-3) moving = true;
      const breathing = p.breathe && !reduced;
      const breath = breathing ? 1 + Math.sin(((t - t0) / 10000) * Math.PI * 2 - Math.PI / 2) * 0.035 : 1;
      group.scale.setScalar(fit * breath);
      group.rotation.set(-0.07 + tiltNow.y * 0.25 * tl, -0.09 + tiltNow.x * 0.4 * tl, -0.025 - tiltNow.x * 0.09 * tl);
      flowers.visible = !!p.flowers;
      renderer.render(scene, camera);
      if (moving || breathing) raf = requestAnimationFrame(frame);
    }
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

    function style() {
      const col = new THREE.Color(String(p.colour));
      material.color.copy(col); material.attenuationColor.copy(col);
      material.transmission = Number(p.glass); material.roughness = Number(p.rough);
      const paper = new THREE.Color(String(p.paper));
      scene.background = paper; renderer.setClearColor(paper, 1);
    }
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.position.set(0, 0, Math.max(4.7, 7.7 / camera.aspect) * 1.72);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      wake();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(stage);

    const norm = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const; };
    let pid = -1;
    canvas.addEventListener("pointerdown", (e) => {
      const [x, y] = norm(e);
      if (poke(x, y, false)) { pid = e.pointerId; canvas.style.cursor = "grabbing"; try { canvas.setPointerCapture(e.pointerId); } catch {} }
      tiltTo.x = x * 2 - 1; tiltTo.y = y * 2 - 1;
      wake();
    });
    canvas.addEventListener("pointermove", (e) => {
      const [x, y] = norm(e);
      if (e.pointerId === pid) { poke(x, y, true); tiltTo.x = x * 2 - 1; tiltTo.y = y * 2 - 1; wake(); }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      if (selected) { selected.userData.target = [0, 0, 0]; selected.userData.active = true; }
      selected = null; pid = -1; canvas.style.cursor = "grab";
      tiltTo.x = tiltTo.y = 0;
      wake();
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    style();
    build();
    return {
      update(next) {
        const rebuild = next.text !== p.text || next.puff !== p.puff;
        p = next;
        style();
        if (rebuild) build();
        wake();
      },
      reset() { for (const m of letters) { m.userData.target = [0, 0, 0]; m.userData.active = true; } wake(); },
      destroy() {
        cancelAnimationFrame(raf); ro.disconnect();
        const geos = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>();
        scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) geos.add(m.geometry); if (m.material) mats.add(m.material as THREE.Material); });
        geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose());
        env.dispose(); renderer.dispose(); renderer.forceContextLoss();
        canvas.remove();
      },
    };
  },
};
