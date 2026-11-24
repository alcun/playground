# Eyes

Grown from the googly eyes that used to sit on alcun.dev: two eyes whose pupils snapped
to the pointer. Now a crowd of them.

```
pointer (or, with nobody pointing, a new spot every 1 to 4 s)
  -> per eye: direction to the target, pulled less when the target is close (eyes converge)
  -> spring toward it: Lag sets stiffness, Wobble takes damping away
blink: random interval from Blinks a minute; the second eye of a pair copies the first
```

- Colours are the theme's paper and ink, so it flips with dark mode.
- Reduced motion: no spring, no blinking, no wandering. The pupils still follow the pointer,
  because that is the interaction.
