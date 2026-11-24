# Jelly letters

Dally's jelly letters: glassy three.js glyphs. Grab one, pull, and every vertex near your finger
follows a spring back home.

```
type a letter -> bake once: extrude Lilita One, tessellate, puff the front by sqrt(distance to outline)
grab          -> raycast the letter, weight each vertex by a smooth ball around the hit (back pinned)
drag          -> target = drag on a camera-facing plane, clamped to Stretch
every frame   -> pull += spring(target - pull); vertex = base + pull * weight; recompute normals
```

- Dally ships 1.1 MB of pre-baked meshes. Here the baker (`tools/build-glyphs.mjs`) runs in the
  browser per letter and is cached, so only the 121 KB font travels. Puff is its puff constant.
- Material, lights, the three-panel studio environment, flowers and the influence field are copied
  from `monostudio/dally/src/jellyScene.js`. Stiffness 145, Damping 11, Grab size 0.62 and
  Stretch 0.9 are Dally's values.
- Lowercase a to z only, as in Dally. `/` starts a new line.
- three.js is the playground's only 3D dependency: its physical glass material is the look, and
  only this demo loads it.
- Font: Lilita One, SIL Open Font License (`OFL.txt`).
- Pulling was checked in Dally on devices; here only the still frame has been looked at headless.
