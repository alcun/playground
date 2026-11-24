# Vines

The Shangri-La Gardening header vines, with the generator's constants turned into controls.

```
seed -> anchors alternating high/low -> smooth cubics (C then S) -> curl at the tip
leaf on every anchor (anchors are the only points exactly on the curve)
growth g: stem dash offset 1-g; a leaf opens once g passes its x along the vine
```

- One vine per corner, mirrored so each grows inward with its leaves hanging into the page.
- Follow scroll, as on the site: the stage scrolls under pinned vines and the scroll position
  is the growth. Scroll length sets how many screens a full grow takes.
- Until the first scroll, Keep growing loops 0 to 1, holds, and recedes, so the index tile
  (which cannot be scrolled) still moves. Moving Growth by hand stops the loop there.
