# Text wave

Two ASCII swells on one canvas grid, mirrored about the centre and moving in
opposite directions. Lines of text stream along the rows of the right-hand swell.

```
for each grid cell:
  swell centre = sin(distance from middle * frequency - time) * height + ripple
  strength     = 1 - distance from swell centre / thickness  (skip if outside)
  shade        = strength plus a fixed per-cell grain
  glyph        = symbols[shade]  or, on the right, the next letter of a line
```

- **Centre gap** flattens both swells towards the middle so they merge into a line there.
- **Frame rate** is deliberately low by default; the stepped motion is part of the look.
- **Text** is split on `; . ,` into lines, run together without spaces. **Glint words** are drawn in the accent colour.
- Colours come from the theme tokens and are re-read when the theme changes.
- With reduced motion, or speed 0, it draws one still frame.
