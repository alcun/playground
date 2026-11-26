# Dot matrix

An LED sign in Signalboarder's amber.

```
message -> drawn once, one pixel per LED: in Station font, Dot Matrix at 10px per
           whole scale, so each font dot is one LED; otherwise the system sans at
           LED rows px tall, alpha > Threshold = lit (Weight and Threshold only apply here)
frame:  every cell drawn as an LED: unlit at Unlit dots, lit ones on top with a glow;
        the message slides under the grid at Scroll LEDs a second and wraps
```

- Station font is Daniel Hart's Dot Matrix, the face Signalboarder's board uses, bundled
  under the OFL (public/fonts, with its notice). One font dot is a tenth of the em, caps
  are 7 dots, descenders 2: measured, not guessed. The dots drawn are still the board's own,
  so dot size, glow and square LEDs still apply. Letters get one extra dark column (two in all) and a softer glow, because at one dark column the glow bridged them. Added 26 November 2026 when Al asked for
  Signalboarder's look; the smooth-font mode had read as too fat.
- Flicker dims a few LEDs on a slow pseudo-random pattern, the way old boards misbehave.
