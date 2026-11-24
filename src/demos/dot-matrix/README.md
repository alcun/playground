# Dot matrix

An LED sign in Signalboarder's amber.

```
message -> drawn once in the system sans at LED rows px tall, one pixel per LED
        -> alpha > Threshold = lit
frame:  every cell drawn as an LED: unlit at Unlit dots, lit ones on top with a glow;
        the message slides under the grid at Scroll LEDs a second and wraps
```

- No dot-matrix font: the dots are real, so resolution, dot size and glow are knobs.
  (Signalboarder's own board uses Daniel Hart's Dot Matrix under the OFL; it is not
  bundled here.)
- Flicker dims a few LEDs on a slow pseudo-random pattern, the way old boards misbehave.
