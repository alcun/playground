/**
 * The index wordmark: letters hung on a Verlet rope. Grab the rope anywhere
 * and swing it; each letter is a little pendulum driven by its knot's motion.
 * The loop sleeps when everything is still. Same physics as the rope demo,
 * kept separate so the demo stays self-contained.
 */
type P = { x: number; y: number; ox: number; oy: number; fixed: boolean };
type Tag = { el: HTMLElement; at: number; a: number; w: number; vx: number };

const SEG = 26, GRAV = 1400, DAMP = 0.985, ITERS = 40, STOP = 0.25;

export function mountHero(root: HTMLElement) {
  const svg = root.querySelector<SVGSVGElement>("svg")!;
  const paths = [...svg.querySelectorAll("path")];
  const hit = svg.querySelector<SVGPathElement>(".hit")!;
  const tags: Tag[] = [...root.querySelectorAll<HTMLElement>(".tag")].map((el) => ({ el, at: 0, a: 0, w: 0, vx: 0 }));
  let P: P[] = [], N = 0, D = 0, running = false, prevDt = 0, last = 0, grab = -1;

  function build() {
    const r = svg.getBoundingClientRect();
    const pad = Math.max(10, r.width * 0.015), y = r.height * 0.14;
    const span = r.width - 2 * pad;
    N = Math.max(8, Math.round(span / SEG) + 1);
    D = (span / (N - 1)) * 1.006; // a touch of slack, so it hangs in a shallow smile
    P = [];
    for (let i = 0; i < N; i++) {
      const x = pad + (span * i) / (N - 1);
      P.push({ x, y, ox: x, oy: y, fixed: i === 0 || i === N - 1 });
    }
    tags.forEach((t, i) => { t.at = Math.round(((i + 0.5) / tags.length) * (N - 3)) + 1; t.a = 0; t.w = 0; });
    prevDt = 0;
    for (let s = 0; s < 300; s++) step(1 / 60);
    prevDt = 0;
    draw();
  }

  function step(dt: number) {
    const tc = prevDt ? Math.min(1.5, dt / prevDt) : 0;
    for (let i = 1; i < N - 1; i++) {
      const q = P[i];
      if (q.fixed) continue;
      const vx = q.x - q.ox, vy = q.y - q.oy;
      q.ox = q.x; q.oy = q.y;
      q.x += vx * tc * DAMP;
      q.y += vy * tc * DAMP + GRAV * dt * dt;
    }
    for (let k = 0; k < ITERS; k++) {
      for (let j = 0; j < N - 1; j++) {
        const a = P[j], b = P[j + 1];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1e-9;
        const diff = (len - D) / len;
        if (!a.fixed) { a.x += dx * diff * 0.25; a.y += dy * diff * 0.25; }
        if (!b.fixed) { b.x -= dx * diff * 0.25; b.y -= dy * diff * 0.25; }
      }
    }
    // Letters swing against their knot's sideways acceleration, and settle.
    for (const t of tags) {
      const q = P[t.at];
      const vx = q.x - q.ox;
      const ax = vx - t.vx;
      t.vx = vx;
      t.w += -0.06 * t.a - ax * 0.012;
      t.w *= 0.9;
      t.a = Math.max(-1.1, Math.min(1.1, t.a + t.w));
    }
    prevDt = dt;
  }

  function moving() {
    let m = 0;
    for (const q of P) m += Math.abs(q.x - q.ox) + Math.abs(q.y - q.oy);
    for (const t of tags) m += Math.abs(t.w) * 40;
    return m;
  }

  function draw() {
    let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
    for (let i = 0; i < N - 1; i++) {
      const p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2 < N ? i + 2 : N - 1];
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    for (const p of paths) p.setAttribute("d", d);
    for (const t of tags) {
      const q = P[t.at];
      t.el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px) rotate(${t.a.toFixed(3)}rad)`;
    }
  }

  function tick(now: number) {
    const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt);
    if (P.some((q) => !isFinite(q.x) || !isFinite(q.y))) { grab = -1; build(); running = false; return; }
    draw();
    if (grab < 0 && moving() < STOP) { running = false; last = 0; return; }
    requestAnimationFrame(tick);
  }
  const wake = () => { if (!running) { running = true; last = 0; requestAnimationFrame(tick); } };

  const local = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function release(e?: PointerEvent) {
    if (grab < 0) return;
    try { if (e && hit.hasPointerCapture(e.pointerId)) hit.releasePointerCapture(e.pointerId); } catch {}
    if (grab !== 0 && grab !== N - 1) P[grab].fixed = false;
    grab = -1;
    root.classList.remove("grabbing");
    wake();
  }
  hit.addEventListener("pointerdown", (e) => {
    const l = local(e);
    let best = 40, near = -1;
    P.forEach((q, i) => { const d = Math.hypot(l.x - q.x, l.y - q.y); if (d < best && i > 0 && i < N - 1) { best = d; near = i; } });
    if (near < 0) return;
    e.preventDefault();
    grab = near;
    P[grab].fixed = true;
    hit.setPointerCapture(e.pointerId);
    root.classList.add("grabbing");
    wake();
  });
  hit.addEventListener("pointermove", (e) => {
    if (grab < 0) return;
    e.preventDefault();
    if (e.pointerType === "mouse" && e.buttons === 0) return release(e);
    const q = P[grab], l = local(e);
    q.ox = q.x; q.oy = q.y; q.x = l.x; q.y = l.y;
    wake();
  });
  hit.addEventListener("pointerup", release);
  hit.addEventListener("pointercancel", release);
  hit.addEventListener("lostpointercapture", release);
  hit.addEventListener("touchmove", (e) => { if (grab >= 0) e.preventDefault(); }, { passive: false });
  addEventListener("pointerup", release);
  addEventListener("blur", () => release());

  let width = 0;
  new ResizeObserver(() => {
    const w = Math.round(svg.getBoundingClientRect().width);
    if (w === width) return;
    width = w;
    build();
    root.classList.add("live");
  }).observe(svg);

  // One small push on arrival, so it is obviously a thing that moves.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(() => {
      if (!P.length || grab >= 0) return;
      const i = Math.floor(N * 0.3);
      P[i].ox = P[i].x - 9; P[i].oy = P[i].y - 3;
      wake();
    }, 450);
  }
}
