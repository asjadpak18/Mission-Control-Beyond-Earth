/**
 * ============================================================================
 * SEEDED PRNG — owned by the Simulation developer (AI 3)
 * ============================================================================
 * A mulberry32-style generator kept as an explicit, serializable state so the
 * whole simulation is deterministic and testable for a given
 * (seed, spacecraft, decisions) triple — as required by the master spec.
 * ============================================================================
 */

export interface RngDraw {
  value: number; // uniform float in [0, 1)
  next: number; // next state
}

export function nextRandom(rngState: number): RngDraw {
  const t = (rngState + 0x6d2b79f5) | 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, next: t };
}

/** Convenience: draw a float in [min, max). */
export function nextRange(rngState: number, min: number, max: number): RngDraw {
  const d = nextRandom(rngState);
  return { value: min + d.value * (max - min), next: d.next };
}

export function makeSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) | 0;
}
