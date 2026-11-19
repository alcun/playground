# Rope

A chain of points integrated with Stormer-Verlet, held together by distance
constraints, drawn as a Catmull-Rom curve so the line you see passes through
the points you can grab.

```
pointer -> grabbed point (pinned to the hand)
             |
tick: integrate free points (velocity * damping + gravity)
      -> N constraint passes pull each pair back to segment length
      -> pin the two ends -> rebuild the SVG path
      -> sleep when total movement falls below a threshold
```

- **Slack** sets segment length relative to the span. Negative is taut.
- **Stiffness passes** is how inextensible it is. Few passes and it stretches.
- **Weightless until touched** rests dead straight, then gains gravity on first grab.
- The timestep ratio is clamped at 1.5. Unclamped, one short frame followed by a
  long one (tab switch, GC pause) multiplies every velocity and the rope explodes.
- An end you drop stays there, clamped so the rope is never held wider than its length.
- The visible stroke is thin; an invisible hit stroke 24px wide (52px on touch) takes the pointer.
- iOS can start a native scroll on an SVG stroke despite `touch-action`, so
  `touchmove` is cancelled while a grab is held.

The Verlet chain started from guerrillacontra's CodePen and was ported from the
footer of alcun.dev.
