# Seal

The hanko carver from Al's Ensō app (`monostudio/enso/src/lib/carve.js`), ported from Skia to canvas 2D.

```
finger points -> steadied (mean of the last N, causal)
              -> corners: a new one only when the hand drifts > Corner feel off the line
                 AND the run since the last corner is >= Shortest run
              -> straight cuts between corners: one width, mitred turns, square ends
cut (hakubun): solid face, strokes knocked out   raised (shubun): strokes in ink
```

- A blade, not a brush: nothing here shares code with the ink brush demo.
- Causal on purpose: a corner once found never moves as the stroke grows.
- Wear knocks out a fixed speckle, so it never shimmers between redraws.
- Opens with 山 already carved, walked out into dense points so the corner finder sees a hand.
  Reset gives a blank block.
