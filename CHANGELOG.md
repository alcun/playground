# Changelog

## Unreleased

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
  you leave.

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
