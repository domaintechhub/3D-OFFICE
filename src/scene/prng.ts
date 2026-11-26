/**
 * Deterministic seeded PRNG utilities (mulberry32).
 * Ensures identical visual layouts, textures, characters, props, and weather
 * across every device and browser session.
 */

export function hashSeed(input: string | number): number {
  if (typeof input === 'number') {
    let x = (input | 0) ^ 0x9e3779b9;
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return (x ^ (x >>> 16)) >>> 0;
  }
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRng(namespace: string | number, baseSeed = 20261125): () => number {
  const combined = hashSeed(namespace) ^ hashSeed(baseSeed);
  return mulberry32(combined >>> 0);
}

export function seededRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function seededPick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
