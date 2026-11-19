# Ink brush

The Sumicat fude brush (`brush.ts`, `feel.ts`, vendored unchanged from sumicat,
MIT). Change the brush there, then copy it here. Do not edit it in place.

```
points [x, y, t] in a 1200-unit world
  -> width from velocity (slow is thick), smoothed over 4 samples
  -> ink tank drains with arc length: wet, then dry bristle tracks (kasure)
  -> dabs of body, hair and bleed sprites onto two layers, bleed under body
  -> paper tooth sampled in world space bites holes in the body
feel.ts maps five 0-1 knobs to the engine constants (power curves, so the
whole slider range does something visible)
```

- Every stroke is kept, and the whole sheet is repainted from points when a
  slider moves, at most once a frame. That is the point of the demo: the same
  marks under a different brush.
- The enso is generated: slow to land, quick round, slowing to lift, with the
  radius breathing a few percent so it does not look drawn with a compass.
  Enso speed changes its timing, and so its width and how far the ink lasts.
- The brush is deterministic: no Math.random, so the same points and seed
  paint the same picture.
- Paper and ink are colour controls; the sheet is the subject, not the theme.
