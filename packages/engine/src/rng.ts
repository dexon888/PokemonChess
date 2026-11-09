/**
 * Source of randomness for the engine. The server injects a seeded instance per match;
 * tests inject a scripted one so every outcome is deterministic.
 */
export interface Rng {
  /** Returns a float in [0, 1). */
  next(): number;
}

/** Small, fast, deterministic PRNG (mulberry32). Same seed → same sequence. */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Replays a fixed list of values; throws if a test consumes more rolls than it scripted. */
export function createScriptedRng(values: readonly number[]): Rng {
  let i = 0;
  return {
    next() {
      const v = values[i++];
      if (v === undefined) throw new Error(`Scripted RNG exhausted after ${values.length} rolls`);
      return v;
    },
  };
}
