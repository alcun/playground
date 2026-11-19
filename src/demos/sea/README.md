# Sea

The wave table from the alcun.dev sea world, drawn as a perspective grid on a
2D canvas instead of a three.js mesh.

```
height(x, z, t) = open water * sum over 4 waves of
                  gain * amplitude * (sin a - crest * cos 2a),   a = k.(x, z) - speed * t + phase
rows: z spaced evenly in 1/z, so they are evenly spaced on screen; far to near
point: screen x = cx + x f / z,  screen y = horizon + (camera - height) f / z
```

- The `- crest * cos 2a` second harmonic sharpens crests and leaves long, rounded
  troughs. Negative values invert that: pointed troughs, round crests.
- Swell and cross swell scale waves 1 and 2; chop scales the two short ones together.
- Wind direction rotates every wave vector; wavelength scales every frequency.
- Shading is relative to the tallest wave the current settings can make, so
  calm water is still legible.
