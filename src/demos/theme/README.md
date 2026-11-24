# Theme

The alcun.dev theme panel: four pixel mode chips and a 24 hour scrub that repaints a small page.

```
mode auto  -> clock hour      mode day/dusk/night -> that palette, fixed
scrub/Hour -> pinned hour     hour -> stop pair (night .. dusk) -> sky bands + night 0..1
chrome (paper, ink, lines, gold) blends between the two stops' palettes,
but only within the current polarity when Hold polarity is on
```

- Hold polarity is the site's rule: light palettes blend among themselves, dark among themselves,
  and the page flips once. Turn it off to see why: paper and ink both pass through mid-grey at
  twilight and the text all but disappears.
- The scrub track is 48 half-hour swatches painted by the same engine as the page.
- The button cycles auto, day, dusk, night. Palettes, stops and icons are copied from alcun.dev
  (`SiteLayout.astro`, `PixelModeIcon.tsx`); nothing is shared at runtime.
