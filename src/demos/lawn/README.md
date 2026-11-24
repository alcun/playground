# Lawn

Grass from the Shangri-La Gardening footer, on canvas so each blade can be cut.

```
seed -> blades (x, layer, height, width, lean)   rebuilt on density/variety/layers/seed
frame: sway = wind * two sines (time, x, phase)  -> draw back layers first, darker
drag:  blades within Mower/2 of the pointer's path -> cut to "Cut to", spray clippings
       every blade regrows to full over "Regrow" seconds
```

- The site draws grass as SVG pattern tiles and mows with one clip-path sweep. Here every
  blade has its own height, which is what makes a mown stripe possible.
- Seeded (mulberry32), so a link reproduces the same lawn.
- The loop sleeps when there is no wind, nothing regrowing and no clippings in the air.
