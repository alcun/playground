/** Read colour tokens for canvas drawing, where CSS variables cannot reach. */
export function tokens<K extends string>(names: K[]): Record<K, string> {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>;
}

/** Fires when the system theme changes. Returns an unsubscribe. */
export function onThemeChange(cb: () => void): () => void {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
