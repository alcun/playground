# Water

The water from Tide: a spring surface over a number, drawn by one fragment shader that bends,
smears and lights whatever sits behind it.

```
128 springs (y, v) --fixed 60 Hz step--> heights + tilt + two slow sines
  -> packed 16-bit into a 128x1 texture
fragment: is this pixel under the surface?
  no  -> the scene (dark sky, white number)
  yes -> displace by a squircle-bezel Snell bend near the edge, smear R/G/B over
         different lengths (rainbow), tint by depth, add a light beam and a teal rim
```

- Level is measured in number heights, not stage height (Tide's was a share of the screen), so
  the waterline sits in the same place on the number at phone width and on a desktop.
- Tap splashes where you tap; drag sideways tips the tank and it sloshes back.
- Shader and springs are copied from Tide (`monostudio/tide`), which adapted them from
  Eugene Yarovoi's Water (MIT, `LICENSE` here). The fixed constants are uniforms so they can be
  sliders: Bend 62, Edge depth 110, Rainbow 0.46, Sway 6, Light 0.2 are Tide's values.
- The colours belong to the subject (night water), so they do not follow the site theme.
- The sway and shimmer never stop, so the loop runs while the demo is on screen; reduced motion
  holds a still, flat surface.
