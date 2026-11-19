import { useEffect, useRef, useState } from "react";
import type { Demo, Instance, Params } from "@/lib/types";
import { defaultsOf, format, initial, persist, randomize } from "@/lib/params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

// Lazy, so each page downloads only its own demo.
const loaders = import.meta.glob<{ demo: Demo }>("../demos/*/demo.ts");

/**
 * Mounts a demo into the stage element and renders its controls. The demo
 * itself is plain DOM/canvas code; React only owns the panel.
 */
export default function DemoPanel({ slug, stageId }: { slug: string; stageId: string }) {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [params, setParams] = useState<Params | null>(null);
  const [copied, setCopied] = useState("");
  const instance = useRef<Instance | null>(null);

  useEffect(() => {
    let gone = false;
    loaders[`../demos/${slug}/demo.ts`]().then(({ demo }) => {
      if (gone) return;
      const start = initial(slug, demo.controls);
      instance.current = demo.mount(document.getElementById(stageId)!, start);
      setDemo(demo);
      setParams(start);
    });
    return () => {
      gone = true;
      instance.current?.destroy();
    };
  }, [slug, stageId]);

  if (!demo || !params) return null;

  const set = (next: Params) => {
    setParams(next);
    persist(slug, demo.controls, next);
    instance.current?.update(next);
  };
  const change = (key: string, v: Params[string]) => set({ ...params, [key]: v });

  const copy = () => {
    navigator.clipboard?.writeText(JSON.stringify(params, null, 2)).then(
      () => setCopied("Copied"),
      () => setCopied("Copy failed"),
    );
    setTimeout(() => setCopied(""), 1200);
  };

  return (
    <div className="flex flex-col gap-4">
      {demo.controls.map((c) => {
        const id = `c-${c.key}`;
        const v = params[c.key];
        if (c.type === "range")
          return (
            <div key={c.key} className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={id}>{c.label}</Label>
                <span className="text-sm text-muted-foreground tabular-nums">{format(Number(v), c)}</span>
              </div>
              <Slider id={id} min={c.min} max={c.max} step={c.step} value={[Number(v)]} onValueChange={([n]) => change(c.key, n)} />
            </div>
          );
        if (c.type === "toggle")
          return (
            <div key={c.key} className="flex items-center justify-between">
              <Label htmlFor={id}>{c.label}</Label>
              <Switch id={id} checked={Boolean(v)} onCheckedChange={(on) => change(c.key, on)} />
            </div>
          );
        if (c.type === "colour")
          return (
            <div key={c.key} className="flex items-center justify-between">
              <Label htmlFor={id}>{c.label}</Label>
              <Input id={id} type="color" className="h-8 w-12 cursor-pointer p-1" value={String(v)} onChange={(e) => change(c.key, e.target.value)} />
            </div>
          );
        return (
          <div key={c.key} className="grid gap-2">
            <Label htmlFor={id}>{c.label}</Label>
            <Input id={id} spellCheck={false} value={String(v)} onChange={(e) => change(c.key, e.target.value)} />
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" onClick={() => set(randomize(demo.controls, params))}>Randomize</Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            set(defaultsOf(demo.controls));
            instance.current?.reset?.();
          }}
        >
          Reset
        </Button>
        <Button size="sm" variant="ghost" onClick={copy}>{copied || "Copy values"}</Button>
      </div>
    </div>
  );
}
