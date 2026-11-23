/** A validation finding. Errors fail `validate:content`; warnings are reported. */
export interface Issue {
  readonly level: 'error' | 'warning';
  /** Stable machine code, e.g. "mcq.catch-all". */
  readonly code: string;
  /** Path relative to content/packs (or another content file). */
  readonly file: string;
  /** Question, node or concept ID the issue is about, if any. */
  readonly id?: string;
  readonly message: string;
}

export function issue(
  level: Issue['level'],
  code: string,
  file: string,
  message: string,
  id?: string,
): Issue {
  return id === undefined ? { level, code, file, message } : { level, code, file, id, message };
}
