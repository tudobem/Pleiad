import type { Random } from '../core/random.ts';

export const systemRandom: Random = {
  next: () => Math.random(),
};
