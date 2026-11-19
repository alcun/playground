// Vendored from sumicat (MIT) packages/brush/src/feel.ts at e1564a2, via alcun-dev. Change it there, then copy.
// @ts-nocheck
/**
 * Brush knobs: what a person asks for, mapped to what the engine runs on.
 *
 * Named for INTENT, not for engine constants. Nobody thinks "I would like more
 * INK_SPAN"; they think the brush should be wetter. One control therefore moves
 * several constants together, and that mapping lives HERE rather than in
 * `brush.ts` - the engine should not have an opinion about which knobs a person
 * considers one idea.
 *
 * It does not live in the UI either, which is where it started. The MCP now
 * takes the same knobs, and `test/ink.test.ts` drives the real brush through
 * them to measure how far a stroke lasts before its tank runs dry. Three
 * callers, one curve: a second copy of these expressions would drift, and the
 * drift would show up as an agent being told the wrong thing about ink.
 *
 * Every knob sits at its default in `DEFAULT_KNOBS` and those defaults
 * reproduce the original constants EXACTLY, so an untouched brush still stamps
 * byte-identically and Gate 0 is untouched.
 */
import { DEFAULT_FEEL, type Feel } from "./brush.js";

export interface Knobs {
  wetness: number;
  dryness: number;
  tooth: number;
  /** The stroke path wobbling. Labelled "jitter" in the UI; it is not paper grain. */
  grain: number;
  /** Shifts every noise field, so the same stroke frays differently. */
  seed: number;
}

export const DEFAULT_KNOBS: Knobs = {
  wetness: 0.5,
  dryness: 0.5,
  tooth: 0.5,
  grain: 0.25,
  seed: 0,
};

/**
 * knobs (0-1, intent) -> Feel (raw engine numbers). Each curve is built so that
 * the default lands exactly on the shipped constant.
 */
export function feelFor(k: Partial<Knobs> | null | undefined): Feel {
  // The per-knob fallbacks below are belt and braces: `model.ts` requires all
  // five on any stored element and the MCP always sends a complete set, so in
  // practice a `k` that exists is a `k` that is whole.
  if (!k) return DEFAULT_FEEL;
  const w = k.wetness ?? 0.5,
    d = k.dryness ?? 0.5;
  const t = k.tooth ?? 0.5,
    g = k.grain ?? 0.5;
  return {
    ...DEFAULT_FEEL,
    // wetter: more ink in the tank, more of it creeping into the paper
    // Ink span is how far the tank lasts, and it needs a POWER curve for the
    // same reason tooth did - except the symptom was different and worse. On a
    // long stroke the old linear 0.5..1.5 range dried out beautifully, exactly
    // like the reference. On a whiteboard nobody draws a stroke that long: a
    // 300-unit line spends about 14% of the tank, so every stroke came out wet
    // whatever the slider said. The knob was not broken, it was out of reach.
    //
    // ^2.2 with a floor makes a low setting drain roughly 16x faster, so an
    // ordinary short stroke reaches the dry bristle tracks. The floor is there
    // because span is a DIVISOR - zero is an infinite depletion rate, and at 0.06
    // the stroke ran dry before it had drawn anything at all.
    flow: DEFAULT_FEEL.flow * (0.7 + 0.6 * w),
    inkSpan: DEFAULT_FEEL.inkSpan * Math.max(0.13, Math.pow(2 * w, 2.2)),
    bleed: DEFAULT_FEEL.bleed * (0.4 + 1.2 * w),
    // drier: more kasure, the flying white left when only some hairs land
    kasure: DEFAULT_FEEL.kasure * (0.3 + 1.4 * d),
    // Tooth and jitter need POWER curves, not linear ones, and very different
    // exponents. Both sit behind small coefficients in the engine, so a linear
    // 0.2..1.8 range moved them so little the sliders felt broken - which is
    // exactly how they were first shipped and exactly what got noticed.
    //
    // Measured. Tooth modulates body density by 0.34 and only starts biting
    // past ~2x its default, so it wants ^2.5: across the slider that now runs
    // mean alpha 221 -> 124 and holes 11k -> 90k.
    //
    // Jitter wanders the dab centre by only 0.17 of its width, so it needs a
    // ~40x span before it is visible at all - raw 0.35 to 15 takes the inked
    // area from 121k to 190k. It is also NOT paper grain: paper is tooth. This
    // is the stroke path wobbling, so it is called what it does.
    //
    // Its default sits at 0.25 rather than 0.5 because turning an already tiny
    // wobble DOWN does nothing visible, so a centred default wasted half the
    // travel. Anchoring at a quarter puts three quarters of the slider in the
    // range that actually moves.
    //
    // `(x/def)^k` is exactly 1 at the default in floating point, so the parity
    // default survives however wide the span either side of it gets.
    tooth: DEFAULT_FEEL.tooth * Math.pow(2 * t, 2.5),
    grain: DEFAULT_FEEL.grain * Math.pow(4 * g, 2.66),
    seed: k.seed ?? 0,
  };
}
