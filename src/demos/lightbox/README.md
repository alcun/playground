# Lightbox

The Shangri-La Gardening gallery lightbox, with a fake network so the blur-up can be watched.

```
tap thumb -> overlay opens at once on a clipped frame holding the cached thumbnail, blurred
          -> full picture "downloads" (Network ms), decodes, then fades in over it (Sharpen ms)
press     -> starts the download early (Preload on touch), so a tap often opens sharp
```

- The pictures are drawn in code at two sizes, never the client's photos.
- Both layers fill one clipped frame, so they cannot size differently, and the blurred one
  is drawn at the frame's exact size with its edge pixels stretched outward, so the blur
  fades out past the clip and the two layers line up. Blurring the picture
  element itself (the first version) spilled a soft halo past its edges while it sharpened.
- A new Network value forgets what was "downloaded", so the next tap shows the wait again.
