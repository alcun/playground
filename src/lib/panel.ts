import type { Control, Params, Range } from "./types";

/**
 * Builds a control panel from a schema. Precedence for starting values is
 * URL hash, then this browser's last values, then the schema defaults. Only
 * values that differ from the defaults go in the hash, so a link stays short
 * and still reproduces exactly what you were looking at.
 */
export function createPanel(
  root: HTMLElement,
  slug: string,
  controls: Control[],
  hooks: { change(p: Params): void; reset?(): void },
): Params {
  const defaults: Params = Object.fromEntries(controls.map((c) => [c.key, c.value]));
  const storeKey = `playground:${slug}`;
  let params: Params = { ...defaults, ...clean(load(storeKey)), ...clean(fromHash()) };
  const inputs = new Map<string, (v: Params[string]) => void>();

  function clean(raw: Record<string, unknown>): Params {
    const out: Params = {};
    for (const c of controls) {
      if (!(c.key in raw)) continue;
      const v = raw[c.key];
      if (c.type === "range") {
        const n = Number(v);
        if (Number.isFinite(n)) out[c.key] = clamp(n, c.min, c.max);
      } else if (c.type === "toggle") out[c.key] = v === true || v === "1" || v === "true";
      else if (c.type === "colour") {
        const hex = String(v).replace(/^#?/, "#");
        if (/^#[0-9a-f]{6}$/i.test(hex)) out[c.key] = hex.toLowerCase();
      } else out[c.key] = String(v);
    }
    return out;
  }

  function commit() {
    try { localStorage.setItem(storeKey, JSON.stringify(params)); } catch {}
    const changed = new URLSearchParams();
    for (const c of controls) {
      const v = params[c.key];
      if (v !== defaults[c.key]) changed.set(c.key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
    const hash = changed.toString();
    history.replaceState(null, "", location.pathname + location.search + (hash ? `#${hash}` : ""));
    hooks.change({ ...params });
  }

  function set(next: Params) {
    params = next;
    for (const [k, write] of inputs) write(params[k]);
    commit();
  }

  const list = document.createElement("div");
  list.className = "controls";
  for (const c of controls) list.append(row(c));

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(
    button("randomize", () => set(randomize(controls, params))),
    button("reset", () => { set({ ...defaults }); hooks.reset?.(); }),
    button("copy", (b) => {
      const text = JSON.stringify(params, null, 2);
      navigator.clipboard?.writeText(text).then(
        () => flash(b, "copied"),
        () => flash(b, "copy failed"),
      );
    }),
  );
  root.append(list, actions);

  function row(c: Control): HTMLElement {
    const id = `c-${c.key}`;
    const wrap = document.createElement("div");
    wrap.className = `control ${c.type}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = c.label;

    if (c.type === "range") {
      const out = document.createElement("output");
      out.htmlFor.add(id);
      const input = Object.assign(document.createElement("input"), {
        type: "range", id, min: String(c.min), max: String(c.max), step: String(c.step),
      });
      const fill = () => input.style.setProperty("--fill", `${((Number(input.value) - c.min) / (c.max - c.min)) * 100}%`);
      const write = (v: Params[string]) => {
        input.value = String(v);
        out.textContent = format(Number(v), c);
        fill();
      };
      write(params[c.key]);
      input.addEventListener("input", () => {
        params = { ...params, [c.key]: Number(input.value) };
        out.textContent = format(Number(input.value), c);
        fill();
        commit();
      });
      inputs.set(c.key, write);
      const head = document.createElement("div");
      head.className = "head";
      head.append(label, out);
      wrap.append(head, input);
    } else if (c.type === "toggle") {
      const input = Object.assign(document.createElement("input"), { type: "checkbox", id, role: "switch" });
      const write = (v: Params[string]) => { input.checked = Boolean(v); };
      write(params[c.key]);
      input.addEventListener("change", () => {
        params = { ...params, [c.key]: input.checked };
        commit();
      });
      inputs.set(c.key, write);
      wrap.append(label, input);
    } else if (c.type === "colour") {
      const input = Object.assign(document.createElement("input"), { type: "color", id });
      const write = (v: Params[string]) => { input.value = String(v); };
      write(params[c.key]);
      input.addEventListener("input", () => {
        params = { ...params, [c.key]: input.value };
        commit();
      });
      inputs.set(c.key, write);
      wrap.append(label, input);
    } else {
      const input = Object.assign(document.createElement("input"), { type: "text", id, spellcheck: false });
      const write = (v: Params[string]) => { input.value = String(v); };
      write(params[c.key]);
      input.addEventListener("input", () => {
        params = { ...params, [c.key]: input.value };
        commit();
      });
      inputs.set(c.key, write);
      wrap.append(label, input);
    }
    return wrap;
  }

  return { ...params };
}

function randomize(controls: Control[], current: Params): Params {
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

function format(v: number, c: Range) {
  return round(v, c.step).toFixed(decimals(c.step)) + (c.unit ?? "");
}
const decimals = (step: number) => (String(step).split(".")[1] ?? "").length;
const round = (v: number, step: number) => Number(v.toFixed(decimals(step)));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function load(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function fromHash(): Record<string, unknown> {
  return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
}

function button(text: string, onClick: (b: HTMLButtonElement) => void) {
  const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, className: "cmd" });
  b.addEventListener("click", () => onClick(b));
  return b;
}

function flash(b: HTMLButtonElement, text: string) {
  const was = b.textContent;
  b.textContent = text;
  setTimeout(() => (b.textContent = was), 1200);
}
