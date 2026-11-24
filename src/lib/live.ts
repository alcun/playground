// Mount each [data-live] element's demo while it is on screen, destroy it when it leaves.
import type { Demo, Instance } from "./types";
import { defaultsOf } from "./params";

const modules = import.meta.glob<{ demo: Demo }>("../demos/*/demo.ts");
const load = (slug: string) => modules[`../demos/${slug}/demo.ts`]().then((m) => m.demo);

const live = new Map<Element, Instance>();

export async function mountInto(el: HTMLElement, slug: string) {
  live.get(el)?.destroy();
  live.delete(el);
  el.replaceChildren();
  const demo = await load(slug);
  live.set(el, demo.mount(el, defaultsOf(demo.controls)));
}

export function watch(selector = "[data-live]") {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting && !live.has(el)) mountInto(el, el.dataset.live!);
      else if (!e.isIntersecting && live.has(el)) { live.get(el)!.destroy(); live.delete(el); el.replaceChildren(); }
    }
  }, { rootMargin: "100px" });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}
