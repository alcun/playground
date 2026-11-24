import type { Demo } from "./types";

// Every folder in src/demos with a demo.ts is a demo; the folder name is its slug.
const modules = import.meta.glob<{ demo: Demo }>("../demos/*/demo.ts", { eager: true });

// The index order, most impressive first. A demo not listed here goes after these, newest first.
const ORDER = ["orb", "paper", "brush", "sea", "pixel-sky", "seal", "lawn", "rope", "pull", "text-wave", "vines", "lightbox", "eyes"];
const rank = (slug: string) => (ORDER.includes(slug) ? ORDER.indexOf(slug) : ORDER.length);

export const demos = Object.entries(modules)
  .map(([path, mod]) => ({ slug: path.split("/").at(-2)!, ...mod.demo }))
  .sort((a, b) => rank(a.slug) - rank(b.slug) || b.updated.localeCompare(a.updated));
