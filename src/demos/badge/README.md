# Name badge

The hero badge from Eponymous (`alcun/eponymous`, `src/components/HeroBadge.astro`),
rewritten without the Atropos library it used.

```
pointer over the card -> target tilt in -1..1 on each axis
tick: ease current tilt toward target (Ease)
      card: rotateX/rotateY by tilt * Tilt
      spiral layer: slides against the tilt (Depth)
      text layer:   slides with it and sits forward in Z
      shine:        a soft highlight under the pointer
no pointer: Idle sway runs a slow figure of eight, or the tilt settles flat
```

- The layered slide is what Atropos's per-layer offsets did. It makes the card
  read as a stack rather than a flat sheet tilting.
- The original background was a stock SVG pattern of rotated pentagons. Here it
  is generated: Sides, Rings, Twist and Line rebuild it, and its colours run from
  the Card colour to the Spiral colour.
- Touch: drag across the card to tilt it; it settles when you let go.
- Idle sway exists for the index tile, which has no pointer.
- Reduced motion: no idle sway and no easing; the card still follows the pointer.
- The loop stops when the tilt has settled and idle sway is off.
