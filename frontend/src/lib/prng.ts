export interface Prng {
  next(): number;
  range(min: number, max: number): number;
  pick<T>(array: readonly T[]): T;
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    pick<T>(array: readonly T[]): T {
      if (array.length === 0) {
        throw new Error("createPrng.pick: cannot pick from empty array");
      }
      const index = Math.floor(next() * array.length);
      return array[index]!;
    },
  };
}
