// Dally's glyph baker (monostudio dally/tools/build-glyphs.mjs), run in the browser per letter instead of shipping
// 1.1 MB of baked meshes: extrude Lilita One, tessellate, puff the front face up by distance from the outline.
import * as THREE from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fontData from "./lilita.typeface.json";

export type Glyph = { width: number; position: Float32Array; index: THREE.BufferAttribute; normal: Float32Array };

let font: Font | null = null;
const cache = new Map<string, Glyph>();

export function glyph(char: string, puff: number): Glyph {
  const key = `${char}:${puff}`;
  const hit = cache.get(key);
  if (hit) return hit;
  font ??= new FontLoader().parse(fontData as never);
  let g: THREE.BufferGeometry = new TextGeometry(char, { font, size: 1, depth: 0.2, curveSegments: 5, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.075, bevelSegments: 3 });
  g = new TessellateModifier(0.18, 2).modify(g);
  const contours: THREE.Vector2[][] = [];
  for (const shape of font.generateShapes(char, 1)) {
    contours.push(shape.getPoints(6));
    for (const h of shape.holes) contours.push(h.getPoints(6));
  }
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(z - 0.2) > 0.001) continue;
    let near = Infinity;
    for (const c of contours) for (let j = 0; j < c.length - 1; j++) {
      const a = c[j], b = c[j + 1], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      near = Math.min(near, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
    }
    p.setZ(i, z + Math.sqrt(near) * puff);
  }
  g.deleteAttribute("normal"); g.deleteAttribute("uv");
  g = mergeVertices(g);
  g.computeVertexNormals(); g.computeBoundingBox();
  const box = g.boundingBox!, w = box.max.x - box.min.x;
  g.translate(-box.min.x - w / 2, -0.36, -0.1);
  const out: Glyph = {
    width: w,
    position: new Float32Array(g.attributes.position.array),
    normal: new Float32Array(g.attributes.normal.array),
    index: g.index!.clone(),
  };
  g.dispose();
  cache.set(key, out);
  return out;
}
