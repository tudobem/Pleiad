/** A question flagged from the feedback screen (SPEC 16.5). Never affects scheduling. */
export type FlagKind = 'wrong' | 'unclear';
export const FLAG_KINDS: readonly FlagKind[] = ['wrong', 'unclear'];
export const NOTE_MAX = 500;

export interface Flag {
  readonly questionId: string;
  readonly kind: FlagKind;
  readonly note?: string;
  /** UTC epoch ms. */
  readonly ts: number;
  readonly appVersion: string;
}

/** A short personal note on a question (SPEC 10.2), kept on-device and in backups. */
export interface Note {
  readonly text: string;
  readonly ts: number;
}

const clean = (text: string | undefined): string | undefined => {
  const t = (text ?? '').trim().slice(0, NOTE_MAX);
  return t.length > 0 ? t : undefined;
};

export function makeFlag(
  questionId: string,
  kind: FlagKind,
  note: string | undefined,
  ts: number,
  appVersion: string,
): Flag {
  const n = clean(note);
  return { questionId, kind, ...(n ? { note: n } : {}), ts, appVersion };
}

/** A note, or null when the text is empty (the note is then removed). */
export function makeNote(text: string, ts: number): Note | null {
  const n = clean(text);
  return n ? { text: n, ts } : null;
}

/** Accept only well-formed flags (stored data may come from an older backup). */
export function isFlag(v: unknown): v is Flag {
  const f = v as Partial<Flag> | null;
  return (
    !!f &&
    typeof f.questionId === 'string' &&
    (FLAG_KINDS as readonly unknown[]).includes(f.kind) &&
    typeof f.ts === 'number'
  );
}

export interface FlagsExport {
  readonly format: 'pleiad-flags';
  readonly exportedAt: string;
  readonly flags: readonly Flag[];
}

/** flags.json (SPEC 16.5): every flag, oldest first. */
export function flagsExport(flags: readonly unknown[], exportedAt: string): FlagsExport {
  return {
    format: 'pleiad-flags',
    exportedAt,
    flags: flags
      .filter(isFlag)
      .sort((a, b) => a.ts - b.ts || (a.questionId < b.questionId ? -1 : 1)),
  };
}
