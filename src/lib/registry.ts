import type { Demo } from "./types";

// Every folder in src/demos with a demo.ts is a demo; the folder name is its slug.
const modules = import.meta.glob<{ demo: Demo }>("../demos/*/demo.ts", { eager: true });

export const demos = Object.entries(modules)
  .map(([path, mod]) => ({ slug: path.split("/").at(-2)!, ...mod.demo }))
  .sort((a, b) => b.updated.localeCompare(a.updated));
