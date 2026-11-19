/** Read colour tokens for canvas drawing, where CSS variables cannot reach. */
export function tokens<K extends string>(names: K[]): Record<K, string> {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>;
}

/** Fires when the resolved theme may have changed (system or toggle). Returns an unsubscribe. */
export function onThemeChange(cb: () => void): () => void {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  addEventListener("playground:theme", cb);
  return () => {
    mq.removeEventListener("change", cb);
    removeEventListener("playground:theme", cb);
  };
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
