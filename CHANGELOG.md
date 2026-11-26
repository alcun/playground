# Changelog

## Unreleased

### Changed

- Dot matrix now draws in the Dot Matrix typeface Signalboarder's board uses, one font dot per LED, with a clear gap between letters and a softer glow, and fits a whole line on a wide screen. It scrolls twice as many dots a second, so it keeps its old pace. The smooth-font look is still there with Station font off.
- Lightbox: the blurred placeholder no longer spills a soft halo past the picture while it sharpens, and the sharp picture now lines up with it exactly.

### Added

- Every toy page says where the toy first lived, in a line under its controls.
- Train: the Signalboarder footer train rebuilt in dots, with sliders for carriages, speed, how often one comes, size and rock.
- Hanging cards: a Cards slider, from 1 up to all 13. The rope always spans the stage, and fewer cards grow to fill it.
- Hanging cards: Swag goes much further, up to 260px of slack.
- Theme and Eyes: their index tiles show the whole demo shrunk to fit, instead of a cramped corner of it.
- Lightbox: the pictures sit centred, three across, and lift and grow a little on hover, as on the Mono Studio site.

## 26 November 2026

### Changed

- The index is now a gallery of framed cards, four across on desktop and two on a phone, each with a short description under its name.
- A small playground mark floats in the top corner of every page and leads back to the index; it replaces the breadcrumb on toy pages.
- The site now lives at playground.alcun.dev.
- Dot matrix starts lighter: single-dot strokes on a taller board, closer to a real station sign.

## 25 November 2026, night

### Removed

- Water, whose shader was not original work.

### Added

- Name badge: the tilting badge from Eponymous, rebuilt without its 3D library, with a generated spiral behind it.
- Washi: a seamless washi paper grain generator, from the grain on the Ensō app's paper.

## 25 November 2026, later

### Removed

- Confetti, which was not original work.

## 25 November 2026

### Added

- Hanging cards: the cards on a rope from the alcun.dev homepage. Brush them, scroll them or lift the rope.

## 24 November 2026, evening

### Added

- Moon: Lune's moon on NASA's maps. Scrub the phase, turn it by hand and let it spring back.
- Jelly letters: Dally's glassy letters you can grab and pull, with the springs, glass and puff as sliders.
- Water: the refracting water from Tide, with the shader's constants as sliders. Tap to splash, drag to tip it.
- Theme: the alcun.dev theme panel, with pixel mode chips and a day scrub that repaints a small page.

## 24 November 2026

### Changed

- The index is a wall of the toys themselves, running live in square tiles with
  their names, instead of cards of text. Each toy only runs while it is on screen.
- The index is ordered by how impressive each toy is, rather than by date.

### Added

- Lawn: grass in a breeze that you mow by dragging across it, and it grows back.
- Vines: seeded vines growing in from the corners as you scroll, with a leaf opening at
  every turn.
- Lightbox: tap a picture and watch it open blurred and sharpen when the full one
  arrives, with a slider for how slow the network is.
- Pixel sky: the alcun.dev pixel sky. Scrub the hour from dawn to night, set the moon's
  phase or use tonight's, and run it as a timelapse.
- Eyes: a crowd of googly eyes that follow your pointer, blink, and look around when
  you leave. The whites stay white in dark mode.
- Seal: carve a hanko with a blade, straight cuts and clean corners, stamped in vermilion.
  From the Ensō app's carver.
- Pull: a face on a cord. Pull it and let go, or tap it to flip; tension, friction and mass
  are sliders.
- Paper: a sheet of paper from clack that bends like paper. Grab it anywhere and fling it.
- Dot matrix: a scrolling LED sign in departure-board amber. Type your own message.
- Confetti: tap anywhere for a burst; every piece turns over as it falls.

## 2026-11-19, shadcn

### Changed

- Built on shadcn/ui: the index cards are shadcn cards and each toy's controls
  are shadcn sliders, switches, inputs and buttons. Light and dark follow the system.

## 2026-11-19, cards

### Changed

- The index is a grid of square cards, two across on a phone.

## 2026-11-19, plain

### Changed

- Plain styling for now: a simple list of toys, native controls beside each
  toy, light and dark from the system. A design pass comes later.

### Removed

- Preview images, the theme switch and the custom styling.

## 2026-11-19, later

### Changed

- A terminal look. The index is a plain listing with a preview of whichever toy
  you point at; each toy fills the screen with a small floating console of
  controls that folds to one line and docks at the bottom on a phone.
- Monospace throughout, square corners, graphite light and dark themes.
- Shorter control names.

### Added

- Preview images for every toy, in light and dark.

## 2026-11-19

### Added

- Orb: Heyra's raymarched light sphere. Hold to talk to it, let go and it turns gold.
- Sea: a rolling sea from four summed waves, as lines or dots, with wind and camera controls.
- Ink brush: the Sumicat sumi brush painting an enso. Paint your own strokes; every stroke repaints as the brush changes.
- A colour control for colours that belong to the subject.
- A playground of interactive demos, each with a control panel: Reset,
  Randomize, Copy values, settings remembered per browser and carried in the URL.
- Rope: a Verlet rope you can grab anywhere, swing and drop.
- Text wave: two ASCII swells with lines of text streaming through one side.
- Light and dark themes, following the system with a manual switch.
