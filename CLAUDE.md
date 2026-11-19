# Playground: rules for adding and changing demos

A static Astro site of small interactive demos. Each demo is one folder in
`src/demos/<slug>/`. Read `src/lib/types.ts` and one existing demo before writing one.

## A demo

- `demo.ts` exports `demo: Demo`. Folder name is the slug and URL. No registration step.
- `README.md` beside it: what it does, a short ASCII flow, the non-obvious
  decisions. Keep it current when the demo changes.
- Self-contained. A demo imports only from `src/lib/`, never from another demo.
  Split into more files in the folder once `demo.ts` passes about 300 lines.
- No DOM access at module top level: `registry.ts` imports every demo at build
  time in Node to read titles. Do all browser work inside `mount`.
- `mount` returns `update(params)` (called with the full set on any change),
  `destroy()`, and optionally `reset()` (called by the panel's Reset after the
  values are restored), for scenes with state of their own.
- Bump `updated` on a meaningful change; the index sorts on it.

## Controls

- Anything tunable is a control in the schema, not a hard-coded constant or a
  stray input. The panel provides Reset, Randomize, Copy values, per-browser
  memory and the URL hash for free.
- Ranges should be wide enough to break things a little. That is the fun.
- Name controls for what you see ("Swell height"), not the variable.
- Randomize leaves text controls alone.

## Look and behaviour

- Colours only from the tokens in `src/styles/global.css`. SVG demos use
  `var(--token)` in CSS; canvas demos read `tokens()` and re-read on
  `onThemeChange()`. Never hard-code a colour, never assume a theme.
- Works at 375px wide with 44px tap targets. Pointer events, not mouse events;
  no hover-only behaviour. Give thin draggable things a wide invisible hit area.
- Respect `prefers-reduced-motion`: a still frame or motion only on interaction.
- Stop animation loops when nothing is moving. Cap canvas DPR at 2.
- Page copy is the title and one sentence. No explanatory paragraphs on the page;
  the explanation lives in the demo's README.
- No new dependencies without a reason a demo cannot meet without them.

## Before committing

- `npm run build` passes (it type-checks first).
- Look at it: light and dark, desktop and about 390px wide.
- Update `CHANGELOG.md`: newest first, Added/Changed/Fixed/Removed as needed,
  sentence case, no emoji or em dashes.
