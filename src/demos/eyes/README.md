# Eyes

Grown from the googly eyes that used to sit on alcun.dev: two eyes whose pupils snapped
to the pointer. Now a crowd of them.

```
pointer (or, with nobody pointing, a new spot every 1 to 4 s)
  -> per eye: direction to the target, pulled less when the target is close (eyes converge)
  -> spring toward it: Lag sets stiffness, Wobble takes damping away
blink: random interval from Blinks a minute; the second eye of a pair copies the first
```

- Whites and pupils are colour controls, not theme colours: eyes are white in any light, and on
  the theme's paper and ink they turned inside out in dark mode. Only the outline follows the theme.
- Reduced motion: no spring, no blinking, no wandering. The pupils still follow the pointer,
  because that is the interaction.
