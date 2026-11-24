# Pull

The hanging avatar from alcun.dev (`DraggableAvatar`), with a drawn face instead of a photo.

```
drag: offset follows the pointer, clamped to Max pull; the face tilts with the cord's angle
let go: a = (-tension * x - friction * v) / mass   (react-spring's equation, substepped at 4 ms)
tap (no movement): +360 on a random axis, on its own slightly bouncy spring
```

- The loop sleeps once everything has settled.
- Reduced motion: no bob, no flip, and a released face snaps home.
