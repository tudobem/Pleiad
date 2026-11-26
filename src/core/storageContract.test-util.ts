/**
 * Behavior every StorageAdapter must have. Run against each implementation
 * (memory in core, IndexedDB in platform). Not shipped.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageAdapter } from './storage.ts';
import type { ReviewEvent } from './sync/reviewEvent.ts';

export function reviewEvent(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    eventId: 'e-1',
    profileId: 'p-1',
    deviceId: 'd-1',
    cardId: 'q-1',
    ts: 1_000,
    mode: 'extra',
    type: 'mcq',
    correct: true,
    rating: 'good',
    responseMs: 1200,
    schedulerStateBefore: null,
    schedulerStateAfter: null,
    appVersion: '0.0.0',
    ...overrides,
  };
}

export function storageContract(name: string, create: () => Promise<StorageAdapter>): void {
  describe(`StorageAdapter contract: ${name}`, () => {
    let storage: StorageAdapter;
    beforeEach(async () => {
      storage = await create();
      await storage.clear();
    });

    it('puts, gets, lists and deletes values per store', async () => {
      await storage.put('settings', 'goal', { daily: 20 });
      await storage.put('meta', 'goal', 'other store');
      expect(await storage.get('settings', 'goal')).toEqual({ daily: 20 });
      expect(await storage.get('meta', 'goal')).toBe('other store');
      expect(await storage.getAll('settings')).toEqual([{ daily: 20 }]);
      await storage.delete('settings', 'goal');
      expect(await storage.get('settings', 'goal')).toBeUndefined();
      expect(await storage.get('meta', 'goal')).toBe('other store');
    });

    it('overwrites on put and isolates stored copies', async () => {
      const value = { n: 1 };
      await storage.put('cards', 'c', value);
      value.n = 2;
      expect(await storage.get('cards', 'c')).toEqual({ n: 1 });
      await storage.put('cards', 'c', { n: 3 });
      expect(await storage.get('cards', 'c')).toEqual({ n: 3 });
    });

    it('appends reviews in insertion order and rejects duplicate eventIds', async () => {
      await storage.appendReview(reviewEvent({ eventId: 'b', ts: 2 }));
      await storage.appendReview(reviewEvent({ eventId: 'a', ts: 1 }));
      await expect(storage.appendReview(reviewEvent({ eventId: 'a' }))).rejects.toThrow();
      expect((await storage.listReviews()).map((e) => e.eventId)).toEqual(['b', 'a']);
    });

    it('lists entries with their keys', async () => {
      await storage.put('notes', 'q-1', 'first');
      await storage.put('notes', 'q-2', { text: 'second' });
      const entries = await storage.entries('notes');
      expect(entries.sort((a, b) => (a[0] < b[0] ? -1 : 1))).toEqual([
        ['q-1', 'first'],
        ['q-2', { text: 'second' }],
      ]);
    });

    it('replaces everything at once, in the given review order', async () => {
      await storage.put('settings', 'old', 1);
      await storage.put('meta', 'deviceId', 'd-old');
      await storage.appendReview(reviewEvent({ eventId: 'old' }));
      await storage.replaceAll({
        reviews: [reviewEvent({ eventId: 'z', ts: 1 }), reviewEvent({ eventId: 'a', ts: 2 })],
        stores: {
          cards: [['c', { n: 1 }]],
          settings: [['learning', { newPerDay: 5 }]],
          notes: [],
          flags: [],
          meta: [['deviceId', 'd-new']],
        },
      });
      expect((await storage.listReviews()).map((e) => e.eventId)).toEqual(['z', 'a']);
      expect(await storage.get('settings', 'old')).toBeUndefined();
      expect(await storage.get('settings', 'learning')).toEqual({ newPerDay: 5 });
      expect(await storage.get('meta', 'deviceId')).toBe('d-new');
      expect(await storage.get('cards', 'c')).toEqual({ n: 1 });
      // Appending after a replace continues the order.
      await storage.appendReview(reviewEvent({ eventId: 'next' }));
      expect((await storage.listReviews()).map((e) => e.eventId)).toEqual(['z', 'a', 'next']);
    });

    it('leaves the old data untouched when a replace fails', async () => {
      await storage.put('settings', 'keep', 1);
      await storage.appendReview(reviewEvent({ eventId: 'keep' }));
      const empty = { cards: [], settings: [], notes: [], flags: [], meta: [] };
      await expect(
        storage.replaceAll({
          reviews: [reviewEvent({ eventId: 'dup' }), reviewEvent({ eventId: 'dup' })],
          stores: { ...empty, settings: [['new', 2]] },
        }),
      ).rejects.toThrow();
      expect(await storage.get('settings', 'keep')).toBe(1);
      expect(await storage.get('settings', 'new')).toBeUndefined();
      expect((await storage.listReviews()).map((e) => e.eventId)).toEqual(['keep']);
    });

    it('clears everything', async () => {
      await storage.put('notes', 'n', 'text');
      await storage.appendReview(reviewEvent());
      await storage.clear();
      expect(await storage.getAll('notes')).toEqual([]);
      expect(await storage.listReviews()).toEqual([]);
    });
  });
}
