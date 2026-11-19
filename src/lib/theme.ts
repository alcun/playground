/** Read colour tokens for canvas drawing, where CSS variables cannot reach. */
export function tokens<K extends string>(names: K[]): Record<K, string> {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(`--${n}`).trim()])) as Record<K, string>;
}

/** Fires after the theme class has changed, so tokens() reads the new colours. Returns an unsubscribe. */
export function onThemeChange(cb: () => void): () => void {
  addEventListener("playground:theme", cb);
  return () => removeEventListener("playground:theme", cb);
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
