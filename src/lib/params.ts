import type { Control, Params, Range } from "./types";

/**
 * Parameter state for a demo's controls, with no UI in it. Starting values come
 * from the URL hash, then this browser's last values, then the schema defaults.
 * Only values that differ from the defaults go in the hash, so a link stays
 * short and still reproduces exactly what you were looking at.
 */
export const defaultsOf = (controls: Control[]): Params =>
  Object.fromEntries(controls.map((c) => [c.key, c.value]));

const storeKey = (slug: string) => `playground:${slug}`;

export function initial(slug: string, controls: Control[]): Params {
  return { ...defaultsOf(controls), ...clean(controls, load(storeKey(slug))), ...clean(controls, fromHash()) };
}

/** Remember the values in this browser and put the non-defaults in the URL hash. */
export function persist(slug: string, controls: Control[], params: Params) {
  try { localStorage.setItem(storeKey(slug), JSON.stringify(params)); } catch {}
  const defaults = defaultsOf(controls);
  const changed = new URLSearchParams();
  for (const c of controls) {
    const v = params[c.key];
    if (v !== defaults[c.key]) changed.set(c.key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  const hash = changed.toString();
  history.replaceState(null, "", location.pathname + location.search + (hash ? `#${hash}` : ""));
}

export function randomize(controls: Control[], current: Params): Params {
  const next = { ...current };
  for (const c of controls) {
    if (c.type === "range") {
      const steps = Math.round((c.max - c.min) / c.step);
      next[c.key] = round(c.min + Math.floor(Math.random() * (steps + 1)) * c.step, c.step);
    } else if (c.type === "toggle") next[c.key] = Math.random() < 0.5;
    else if (c.type === "colour") next[c.key] = "#" + Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, "0");
    // Text is left alone: random strings are never what anyone wanted.
  }
  return next;
}

export function format(v: number, c: Range) {
  return round(v, c.step).toFixed(decimals(c.step)) + (c.unit ?? "");
}

function clean(controls: Control[], raw: Record<string, unknown>): Params {
  const out: Params = {};
  for (const c of controls) {
    if (!(c.key in raw)) continue;
    const v = raw[c.key];
    if (c.type === "range") {
      const n = Number(v);
      if (Number.isFinite(n)) out[c.key] = Math.min(c.max, Math.max(c.min, n));
    } else if (c.type === "toggle") out[c.key] = v === true || v === "1" || v === "true";
    else if (c.type === "colour") {
      const hex = String(v).replace(/^#?/, "#");
      if (/^#[0-9a-f]{6}$/i.test(hex)) out[c.key] = hex.toLowerCase();
    } else out[c.key] = String(v);
  }
  return out;
}

const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
const round = (v: number, step: number) => Number(v.toFixed(decimals(step)));

function load(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const fromHash = (): Record<string, unknown> => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
