# Pixel sky

The sky from the alcun.dev pixel banner: its palette stops, its moon and its cloud.

```
hour -> stop pair (night, predawn, dawn, day, sunset, dusk) -> blended palette + night 0..1
sun  on an arc 06:00 to 20:00 while night <= 0.6
moon on an arc 18:00 to 06:00 while night >  0.6, carved by phase:
     each row's terminator x = +-halfwidth * cos(2*pi*phase), unlit side painted with sky
stars fade in with night squared; clouds drift and wrap
```

- Drawn on a canvas one cell per pixel and scaled up with `image-rendering: pixelated`, so
  Pixel size is the whole look.
- Tonight's moon uses a mean synodic month, good to about a day. alcun.dev uses a full lunar
  model; this demo does not need it.
- The headland, lighthouse and city stay on alcun.dev.
