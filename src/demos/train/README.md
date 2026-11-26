# Train

The Signalboarder footer train, rebuilt from dots.

```
build:  carriages (back cab, middles, front cab) -> one grid of dot states each
        -> painted once to an offscreen canvas, lit and unlit dots
frame:  slide that canvas across at Speed dots a second, draw the wheels on top
        with one lit dot turning by the distance travelled
gone:   the next train leaves Every seconds after this one left, or at once if late
```

- Signalboarder's footer train is one picture; a picture cannot have more carriages,
  so this one is made of dots in code, in the same style.
- Only the wheels are drawn each frame. The body is one image slid sideways, as the
  footer does, because redrawing hundreds of dots per frame is the expensive part.
- Rock sways the body, never the wheels, so it still sits on the rail.
- The loop stops between trains and restarts on a timer.
