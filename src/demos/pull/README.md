# Pull

The hanging avatar from alcun.dev (`DraggableAvatar`), with a plain avatar in place of
Al's photo, or the visitor's own picture.

```
drag: the avatar chases the pointer on a stiff light spring (600 / 35 / 1), clamped
      to Max pull; it tilts with the cord's angle
let go: a = (-tension * x - friction * v) / mass   (react-spring's equation, substepped at 4 ms)
tap (no movement): +360 on a random axis, on its own slightly bouncy spring
picture: file -> centre-cropped to 256px JPEG -> this browser's localStorage only
```

- Defaults are alcun.dev's: tension 25, friction 6 and a release mass of 5 ("bowling
  ball heavy" in its source). Mass 1, the first version, felt dead; Al said so on
  26 November 2026. The drag spring is alcun.dev's too: pinning the avatar to the
  pointer lost the stretch.
- The picture is never uploaded anywhere. The button only appears on the toy's own page.
- The loop sleeps once everything has settled.
- Reduced motion: no bob, no flip, the drag follows the pointer exactly and a released
  avatar snaps home.
