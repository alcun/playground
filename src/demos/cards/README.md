# Hanging cards

The "things I've made" rigging from the alcun.dev homepage
(`alcun-dev/src/components/MadeHere`): cards hung off a rope on a chain of
coupled pendulums, and a rope you can lift.

```
tick (fixed 60Hz steps):
  each card: spring to its breeze angle (stiffness 0.2 / hanger length)
           + coupling to both neighbours   -> a flick travels as a wave
           + scroll delta * pull            -> scrolling throws the row
  each knot: spring to the line + drag on neighbours, gutter ends tied off
paint: rotate cards, counter-rotate icons, ride each card on its knot, redraw the rope
```

- The breeze is one cosine per card with its own period and offset, so the row
  never moves as a block.
- Scroll pull is weighted per card. On alcun.dev it was 0.022 at first, which
  pinned every card to the max swing on a normal drag, and at the cap they all
  look identical.
- The rope's spring and damping are a damping ratio, not separate dials:
  `zeta = (1 - damping) / (2 * sqrt(spring))`. The defaults give about 0.49,
  roughly 17% overshoot and two rebounds. Lower damping rings like a guitar string.
- The rope is a quadratic with its control point BELOW each pair of knots, so it
  swags between boards rather than passing through them, and it runs past the
  rig at both ends so it never stops in mid air.
- The rope's hit band is a 24px invisible stroke (44px on touch) that stops the
  pointer reaching the scroller, so lifting the rope never drags the row.
- Mouse drag scrolls with a flick glide; touch keeps native scrolling.
- Differences from alcun.dev: no CSS-animation handoff at rest (the loop just
  runs while the toy is on screen), constant coupling, and the cards are not links.
- Reduced motion: a still row; the rope can still be lifted and drops back.

The icons are alcun.dev's own.
