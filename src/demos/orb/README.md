# Orb

A fragment shader, from Heyra (speech to text). One full-screen triangle; each
pixel casts a ray, and where it hits the unit sphere the ray is marched through
it in a fixed number of steps.

```
ray -> sphere entry/exit -> N steps through the inside
  each step: rotate by twist * radius - wind   (winds shells round a leaning axis)
             warp the point with layered sines  (Warp, Warp layers)
             gyroid g = sin x cos y + sin y cos z + sin z cos x
             sheet light = softness / (g^2 + softness)  (thin glowing surfaces where g = 0)
             + a gaussian spine of light along the axis
  sum -> 1 - exp(-light * exposure) -> disc + halo
```

- Pressing and holding fakes a voice level with two beating sines; letting go
  turns it gold and speeds the wind for 1.6s, as the real one does while it writes.
- Ray steps is a uniform with a fixed loop cap of 128 and an early `break`, so
  the slider does not recompile the shader.
- DPR is capped at 1.25: the image is soft and a raymarch per pixel is expensive.
- The three colours are part of the subject rather than the theme, so they are
  colour controls. The sphere is dark in both themes on purpose.
