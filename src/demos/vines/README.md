# Vines

The Shangri-La Gardening header vines, with the generator's constants turned into controls.

```
seed -> anchors alternating high/low -> smooth cubics (C then S) -> curl at the tip
leaf on every anchor (anchors are the only points exactly on the curve)
growth g: stem dash offset 1-g; a leaf opens once g passes its x along the vine
```

- One vine per corner, mirrored so each grows inward with its leaves hanging into the page.
- Keep growing loops 0 to 1, holds, and recedes. Moving Growth by hand stops the loop there.
