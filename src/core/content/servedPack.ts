import type { PackContent } from './source.ts';
import type { LoadedPack, Question, Thinker } from './types.ts';

/** MIME type of an inlined image by file extension. */
export function mediaMime(src: string): string {
  const ext = src.split('.').pop()?.toLowerCase();
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return `image/${ext ?? 'png'}`;
}

/**
 * A pack as the app receives it (SPEC 5.3): verified questions only, each
 * image inlined as a data URI (so it is cached and offline with the pack),
 * and the thinkers its attribution questions name.
 */
export function servedPack(
  pack: LoadedPack,
  thinkers: ReadonlyMap<string, Thinker>,
  /** Base64 of a media file, by its pack-relative path. */
  readBase64: (src: string) => string,
  /** `draft` builds the review file (SPEC 16.4 path B); default `verified`. */
  status: 'verified' | 'draft' = 'verified',
): PackContent {
  const questions: Question[] = pack.questionFiles
    .flatMap((f) => f.questions)
    .filter((q) => q.status === status)
    .map((q) =>
      q.media
        ? {
            ...q,
            media: q.media.map((m) => ({
              ...m,
              src: `data:${mediaMime(m.src)};base64,${readBase64(m.src)}`,
            })),
          }
        : q,
    );
  const named = new Set(
    questions.flatMap((q) => (q.type === 'attribution' ? [q.thinker, ...q.options] : [])),
  );
  const used = [...named].flatMap((id) => {
    const t = thinkers.get(id);
    return t ? [t] : [];
  });
  return { meta: pack.meta, questions, ...(used.length > 0 ? { thinkers: used } : {}) };
}
