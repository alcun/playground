# Washi

The paper grain from Al's Ensō app. The app lays a baked seamless tile
(`monostudio/enso/assets/washi@2x.png`, via `Grain.js`) over the sheet, over the
ink as well as the paper, because ink on washi sits in the fibres. That tile has
no generator in any repo, so this is one.

```
tile (seeded):  tooth   per-pixel noise, half lifting, half shading
                flecks  tiny slivers, the cloudy tooth of the sheet
                fibres  random walks whose heading drifts by Curl
                every mark drawn at nine offsets, so the tile wraps seamlessly
stage:          paper colour -> optional ink ring -> the tile as a repeating pattern
```

- The grain is mostly transparent and mostly light, so it reads on any paper
  colour, warm white to sumi black. Dark fibres are kept at a third of the
  strength of light ones; at full strength they read as scratches.
- Light fibres sets the share of light fibres against dark ones.
- Seed picks a different sheet; the same seed always gives the same tile.
- Changing only the colours or the ink toggle repaints without rebuilding the tile.
- It is static, so there is no animation loop and nothing for reduced motion to stop.
