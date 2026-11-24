# Moon

The moon from Lune: a ray-traced sphere wearing NASA's real colour and height maps, lit by the Sun.

```
pixel -> inside the disc? -> eye ray hits the sphere at n
n -> libration (lon, lat) -> map uv -> LROC colour + LOLA height gradient -> bumped normal
light: phase angle a -> (sin a, 0, -cos a), turned by Tilt
colour = chalky lunar scattering (diffuse / (view + diffuse)) + earthshine on the night side
```

- The material is `monostudio/lune/src/lib/moon-shader.js`, ported from Skia's SkSL to WebGL
  line for line. Relief 0.7, Earthshine 0.073 and Brightness 1.36 are Lune's values.
- Lune works out phase, libration and the bright limb's angle from a full lunar model for a place
  and time. Here they are sliders; Tonight's moon uses a mean synodic month, good to about a day.
- Drag turns the moon to see the far side; let go and Return springs it back to the face we see.
- Maps: NASA Scientific Visualization Studio, LROC WAC colour (2048 by 1024) and LOLA elevation
  preview (1024 by 512), https://svs.gsfc.nasa.gov/4720/. LROC imagery: NASA, GSFC and Arizona
  State University; LOLA: NASA and GSFC; visualisation by Ernie Wright. Public domain, credited.
