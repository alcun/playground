# Paper

A sheet of paper from clack, the browser typewriter. `cloth.ts` is vendored unchanged from
`alcun/clack` `src/lib/cloth.ts` (24 November 2026): change it there, then copy.

```
grid of 3D Verlet points (Mesh across x Mesh down)
links: structural, shear, and bend links that skip 2, 3 and 4 points  <- paper, not a tea towel
step:  velocity * Air + pull home * Memory + Gravity, then Stiffness rounds of link solving
grab:  the nearest point and its 8 neighbours held rigidly, like finger and thumb
render: affine texture per triangle, far side of a fold first; light painted small and blurred
```

- The sheet is clack's size in its own units (1036 x 1462) and scaled to fit; Perspective is
  the camera depth in those units.
- The page is a few lines of The Tempest (public domain), typed in the system monospace.
- The loop sleeps when the fastest point is nearly still.
