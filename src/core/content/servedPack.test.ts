import { describe, expect, it } from 'vitest';
import { attribution, imageMcq, mcq, pack, THINKERS } from './fixtures.test-util.ts';
import { mediaMime, servedPack } from './servedPack.ts';

describe('servedPack', () => {
  it('serves verified questions with inlined images and the thinkers they name', () => {
    const verified = { status: 'verified' as const, verified_on: '2026-01-02' };
    const p = pack([
      imageMcq(verified as never),
      attribution(verified),
      mcq({ id: 'q-draft', status: 'draft' }),
    ]);
    const served = servedPack(p, new Map(THINKERS.map((t) => [t.id, t])), (src) => `B64(${src})`);
    expect(served.questions.map((q) => q.id)).toEqual(['q-img-0001', 'q-attr-0001']);
    expect(served.questions[0]?.media?.[0]?.src).toBe(
      'data:image/svg+xml;base64,B64(media/cube.svg)',
    );
    expect(served.thinkers?.map((t) => t.id).sort()).toEqual([
      'baars',
      'chalmers',
      'koch',
      'tononi',
    ]);
  });

  it('maps extensions to image types', () => {
    expect(mediaMime('a.svg')).toBe('image/svg+xml');
    expect(mediaMime('a.JPG')).toBe('image/jpeg');
    expect(mediaMime('a.webp')).toBe('image/webp');
  });
});
