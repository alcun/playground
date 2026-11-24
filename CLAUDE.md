# Playground: rules for adding and changing demos

A static Astro site of small interactive demos. Each demo is one folder in
`src/demos/<slug>/`. Read `src/lib/types.ts` and one existing demo before writing one.

UI is shadcn/ui (radix, Nova preset, neutral) on Tailwind 4 with React islands.
The control panel is `src/components/DemoPanel.tsx`; its state logic (URL hash,
saved values, randomize) is plain functions in `src/lib/params.ts`. Demos stay
framework-free: plain DOM, SVG or canvas. Add shadcn components with
`npx shadcn@latest add <name>`.

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
- Bump `updated` on a meaningful change. The index order is the `ORDER` list in
  `src/lib/registry.ts`, most impressive first; place a new demo there.

## Controls

- Anything tunable is a control in the schema, not a hard-coded constant or a
  stray input. The panel provides Reset, Randomize, Copy values, per-browser
  memory and the URL hash for free.
- Ranges should be wide enough to break things a little. That is the fun.
- Name controls for what you see ("Height", "Wind"), not the variable, in one or two
  short words.
- Randomize leaves text controls alone.

## Look and behaviour

- Colours only from the demo tokens in `src/styles/global.css` (`--paper`, `--ink`,
  `--ink-soft`, `--ink-faint`, `--hair`, `--glint`, `--rope`), which map onto
  shadcn's theme. Do not use shadcn's `--accent` in a demo: it is a surface
  colour, not a highlight. SVG demos use
  `var(--token)` in CSS; canvas demos read `tokens()` and re-read on
  `onThemeChange()`. Never hard-code a colour, never assume a theme.
  The exception is a colour that belongs to the subject (ink, paper, a glow):
  make it a `colour` control so it is visible and tunable, not buried.
- Vendored code (the brush) is changed at its source, then copied. Say where it
  came from in its first line.
- Works at 375px wide with 44px tap targets. Pointer events, not mouse events;
  no hover-only behaviour. Give thin draggable things a wide invisible hit area.
- Respect `prefers-reduced-motion`: a still frame or motion only on interaction.
- Stop animation loops when nothing is moving. Cap canvas DPR at 2.
- Page copy is the title and one sentence. No explanatory paragraphs on the page;
  the explanation lives in the demo's README.
- No new dependencies without a reason a demo cannot meet without them.

## Before committing

- `npm run build` passes (it type-checks first).
- Look at it: light and dark, desktop and about 390px wide. Use shadcn's defaults
  as they are on the toy pages.
- The index runs every demo live in a square tile, with pointer events off,
  mounted while on screen and destroyed when it scrolls away (`src/lib/live.ts`).
  A demo's default values are its index tile, so they should look good at rest.
- Update `CHANGELOG.md`: newest first, Added/Changed/Fixed/Removed as needed,
  sentence case, no emoji or em dashes.
