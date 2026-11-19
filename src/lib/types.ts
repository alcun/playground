export type Range = {
  type: "range";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
};
export type Toggle = { type: "toggle"; key: string; label: string; value: boolean };
export type Text = { type: "text"; key: string; label: string; value: string };
/** A hex colour, #rrggbb. Use for colours that are part of the subject, not the theme. */
export type Colour = { type: "colour"; key: string; label: string; value: string };
export type Control = Range | Toggle | Text | Colour;

export type Params = Record<string, number | boolean | string>;

export interface Instance {
  /** Called with the full parameter set whenever any control changes. */
  update(params: Params): void;
  /** Optional: put the scene back to its starting state (the panel's Reset calls it). */
  reset?(): void;
  destroy(): void;
}

export interface Demo {
  title: string;
  description: string;
  /** YYYY-MM-DD of the last meaningful change; the index sorts on it. */
  updated: string;
  controls: Control[];
  /** Runs in the browser only. Never touch the DOM at module top level. */
  mount(stage: HTMLElement, params: Params): Instance;
}
