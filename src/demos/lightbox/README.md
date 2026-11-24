# Lightbox

The Shangri-La Gardening gallery lightbox, with a fake network so the blur-up can be watched.

```
tap thumb -> overlay opens at once, showing the cached thumbnail as the image's own
             background, blurred
          -> full picture "downloads" (Network ms), decodes, then the blur unwinds (Sharpen ms)
press     -> starts the download early (Preload on touch), so a tap often opens sharp
```

- The pictures are drawn in code at two sizes, never the client's photos.
- The reveal is the sharpening, not a crossfade: there is nothing around the image that
  could size differently to it.
- A new Network value forgets what was "downloaded", so the next tap shows the wait again.
