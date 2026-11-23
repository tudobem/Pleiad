import type { IdGenerator } from '../core/ids.ts';

export const uuidIds: IdGenerator = {
  newId: () => crypto.randomUUID(),
};
