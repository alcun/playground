# Playground

Small interactive demos with the knobs left on. Every demo gets a control panel
with Reset, Randomize and Copy values, and its settings live in the URL, so a
link reproduces exactly what you were looking at.

Static Astro site, no framework runtime, no database. Light and dark themes
come from a handful of CSS tokens.

## Run it

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # type-checks, then writes dist/
```

Or with Docker: `docker build -t playground . && docker run -p 8080:80 playground`.
Set the `PUBLIC_SITE_URL` build argument for canonical links.

## Add a demo

Make `src/demos/<slug>/demo.ts` exporting a `demo` (see `src/lib/types.ts`).
The folder name is the URL. The index and the page are generated from it.

```ts
export const demo: Demo = {
  title: "Ripple",
  description: "One sentence.",
  updated: "2026-11-19",
  controls: [
    { type: "range", key: "speed", label: "Speed", min: 0, max: 4, step: 0.1, value: 1 },
    { type: "toggle", key: "trail", label: "Trail", value: true },
  ],
  mount(stage, params) {
    // draw into stage; return { update(params), reset?(), destroy() }
  },
};
```

Rules for demos, written for people and coding agents alike, are in
[CLAUDE.md](CLAUDE.md).

## Licence

MIT.
