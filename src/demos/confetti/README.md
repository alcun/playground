# Confetti

From alcun.dev's party mode, where the Konami code drops 100 squares from the top of the page.

```
tap -> Pieces launched in a cone (Spread) at up to Power px/s
each piece: a card turning over: drawn height = cos(flip), so it flutters
            drag x how open it is to the air (face-on catches more than edge-on)
            plus a sideways Sway, and Gravity
```

- The palette is alcun.dev's party palette, kept as it was.
- Auto pop fires a burst every few seconds so the index tile has something to show; 0 turns it off.
- Reduced motion: no auto pop. A tap still bursts, because that is the interaction.
